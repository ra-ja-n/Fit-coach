package com.fitcoach.coach;

import com.fitcoach.common.ApiException;
import com.fitcoach.security.OwnershipGuard;
import com.fitcoach.subscription.SubscriptionRepository;
import com.fitcoach.subscription.SubscriptionStatus;
import com.fitcoach.user.User;
import com.fitcoach.user.UserRepository;
import com.fitcoach.user.UserRole;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CoachService {

    private final CoachProfileRepository profiles;
    private final CoachingPackageRepository packages;
    private final UserRepository users;
    private final SubscriptionRepository subscriptions;
    private final OwnershipGuard guard;

    public CoachService(CoachProfileRepository profiles, CoachingPackageRepository packages,
                        UserRepository users, SubscriptionRepository subscriptions, OwnershipGuard guard) {
        this.profiles = profiles;
        this.packages = packages;
        this.users = users;
        this.subscriptions = subscriptions;
        this.guard = guard;
    }

    // ------------------------------------------------------- public reads ---

    /** Approved coaches only. Pending/rejected profiles are invisible. */
    @Transactional(readOnly = true)
    public List<CoachDtos.CoachProfileDto> listApproved() {
        List<CoachDtos.CoachProfileDto> out = new ArrayList<>();
        for (CoachProfile p : profiles.findByStatusOrderByUpdatedAtDesc(CoachStatus.approved)) {
            User u = users.findById(p.getUserId()).orElse(null);
            if (u == null) continue;
            List<CoachingPackage> pkgs = packages.findByCoachIdOrderByPriceCentsAsc(p.getUserId());
            Long from = pkgs.isEmpty() ? null : pkgs.get(0).getPriceCents();
            out.add(new CoachDtos.CoachProfileDto(
                    p.getUserId(), u.getName(), p.getBio(), List.copyOf(p.getSpecialties()),
                    p.getExperienceYears(), p.getStatus(), from,
                    subscriptions.countByCoachIdAndStatus(p.getUserId(), SubscriptionStatus.active)));
        }
        return out;
    }

    /**
     * Public detail for one approved coach. A pending/rejected or unknown coach
     * is a plain 404 — discovery never leaks who exists but isn't approved.
     */
    @Transactional(readOnly = true)
    public Record<CoachDtos.CoachProfileDto, List<CoachDtos.PackageDto>> getPublic(UUID coachId) {
        CoachProfile p = profiles.findById(coachId)
                .filter(x -> x.getStatus() == CoachStatus.approved)
                .orElseThrow(ApiException::notFound);
        User u = users.findById(coachId).orElseThrow(ApiException::notFound);
        List<CoachingPackage> pkgs = packages.findByCoachIdOrderByPriceCentsAsc(coachId);
        Long from = pkgs.isEmpty() ? null : pkgs.get(0).getPriceCents();
        var dto = new CoachDtos.CoachProfileDto(
                p.getUserId(), u.getName(), p.getBio(), List.copyOf(p.getSpecialties()),
                p.getExperienceYears(), p.getStatus(), from,
                subscriptions.countByCoachIdAndStatus(coachId, SubscriptionStatus.active));
        return new Record<>(dto, pkgs.stream().map(CoachDtos.PackageDto::from).toList());
    }

    /** Simple pair holder for "profile + its packages". */
    public record Record<A, B>(A profile, B packages) {}

    // -------------------------------------------------- coach-owned writes ---

    @Transactional(readOnly = true)
    public CoachDtos.CoachProfileDto myProfile(User coach) {
        CoachProfile p = requireProfile(coach.getId());
        List<CoachingPackage> pkgs = packages.findByCoachIdOrderByPriceCentsAsc(coach.getId());
        Long from = pkgs.isEmpty() ? null : pkgs.get(0).getPriceCents();
        return new CoachDtos.CoachProfileDto(p.getUserId(), coach.getName(), p.getBio(),
                List.copyOf(p.getSpecialties()), p.getExperienceYears(), p.getStatus(), from,
                subscriptions.countByCoachIdAndStatus(coach.getId(), SubscriptionStatus.active));
    }

    @Transactional
    public CoachDtos.CoachProfileDto updateProfile(User coach, CoachDtos.UpdateProfileRequest req) {
        guard.requireCoachOwns(coach, coach.getId());
        CoachProfile p = requireProfile(coach.getId());
        if (req.bio() != null) p.setBio(req.bio().trim());
        if (req.specialties() != null) {
            p.setSpecialties(req.specialties().stream()
                    .map(String::trim).filter(s -> !s.isEmpty()).distinct().limit(20).toList());
        }
        if (req.experienceYears() != null) p.setExperienceYears(req.experienceYears());
        return myProfile(coach);
    }

    /** Created on registration so every coach always has an editable profile row. */
    @Transactional
    public CoachProfile ensureProfile(UUID coachId) {
        return profiles.findById(coachId).orElseGet(() -> {
            CoachProfile p = new CoachProfile();
            p.setUserId(coachId);
            p.setBio("");
            p.setSpecialties(new ArrayList<>());
            p.setStatus(CoachStatus.pending);
            return profiles.save(p);
        });
    }

    // ---------------------------------------------------------- packages ---

    @Transactional(readOnly = true)
    public List<CoachDtos.PackageDto> myPackages(User coach) {
        return packages.findByCoachIdOrderByPriceCentsAsc(coach.getId())
                .stream().map(CoachDtos.PackageDto::from).toList();
    }

    /** A package is readable by any authenticated user — it's an offer for sale. */
    @Transactional(readOnly = true)
    public CoachDtos.PackageDto getPackage(UUID packageId) {
        return packages.findById(packageId)
                .map(CoachDtos.PackageDto::from)
                .orElseThrow(ApiException::notFound);
    }

    @Transactional(readOnly = true)
    public String coachNameOf(UUID coachId) {
        return users.findById(coachId).map(User::getName).orElse("");
    }

    @Transactional
    public CoachDtos.PackageDto savePackage(User coach, CoachDtos.SavePackageRequest req) {
        guard.requireCoachOwns(coach, coach.getId());
        if (req.title() == null || req.title().trim().length() < 3) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", "Title is too short");
        }
        if (req.priceCents() == null || req.priceCents() < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", "Enter a valid price");
        }
        if (req.durationDays() == null || req.durationDays() < 1 || req.durationDays() > 365) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", "Duration: 1-365 days");
        }
        CoachingPackage pkg;
        if (req.id() != null) {
            pkg = packages.findByIdAndCoachId(req.id(), coach.getId()).orElseThrow(ApiException::notFound);
        } else {
            pkg = new CoachingPackage();
            pkg.setCoachId(coach.getId());
        }
        pkg.setTitle(req.title().trim());
        pkg.setPriceCents(req.priceCents());
        pkg.setDurationDays(req.durationDays());
        pkg.setFeatures(req.features() == null ? List.of()
                : req.features().stream().filter(Objects::nonNull).map(String::trim)
                        .filter(s -> !s.isEmpty()).limit(20).toList());
        return CoachDtos.PackageDto.from(packages.save(pkg));
    }

    @Transactional
    public void deletePackage(User coach, UUID packageId) {
        guard.requireCoachOwns(coach, coach.getId());
        CoachingPackage pkg = packages.findByIdAndCoachId(packageId, coach.getId())
                .orElseThrow(ApiException::notFound);
        // Subscriptions reference packages; deleting one would orphan paid history.
        if (subscriptions.existsByPackageId(pkg.getId())) {
            throw new ApiException(HttpStatus.CONFLICT, "PACKAGE_IN_USE",
                    "This package has subscribers and cannot be deleted. Edit it instead.");
        }
        packages.delete(pkg);
    }

    @Transactional(readOnly = true)
    public CoachProfile requireProfile(UUID coachId) {
        return profiles.findById(coachId).orElseThrow(ApiException::notFound);
    }

    @Transactional(readOnly = true)
    public CoachStatus statusOf(User user) {
        if (user.getRole() != UserRole.coach) return null;
        return profiles.findById(user.getId()).map(CoachProfile::getStatus).orElse(CoachStatus.pending);
    }
}
