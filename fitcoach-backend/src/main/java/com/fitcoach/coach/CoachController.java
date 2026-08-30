package com.fitcoach.coach;

import com.fitcoach.user.User;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Coach profile + packages.
 *
 * Path convention (deliberate, and load-bearing for SecurityConfig):
 *   /api/coaches/**  -> PUBLIC discovery reads (no auth)
 *   /api/coach/**    -> the signed-in coach's own resources (auth required)
 * "coaches" plural is only ever a public browse; nothing self-scoped lives
 * there, so the permitAll matcher can never widen into private data.
 */
@RestController
public class CoachController {

    private final CoachService coaches;

    public CoachController(CoachService coaches) {
        this.coaches = coaches;
    }

    // ------------------------------------------------------ public (no auth) ---

    @GetMapping("/api/coaches")
    public List<CoachDtos.CoachProfileDto> listApproved() {
        return coaches.listApproved();
    }

    @GetMapping("/api/coaches/{coachId}")
    public Map<String, Object> getPublic(@PathVariable UUID coachId) {
        var record = coaches.getPublic(coachId);
        return Map.of("profile", record.profile(), "packages", record.packages());
    }

    // ----------------------------------------------------- coach's own (auth) ---

    @GetMapping("/api/coach/profile")
    @PreAuthorize("hasRole('COACH')")
    public CoachDtos.CoachProfileDto myProfile(@AuthenticationPrincipal User coach) {
        return coaches.myProfile(coach);
    }

    @PutMapping("/api/coach/profile")
    @PreAuthorize("hasRole('COACH')")
    public CoachDtos.CoachProfileDto updateProfile(@AuthenticationPrincipal User coach,
                                                   @RequestBody CoachDtos.UpdateProfileRequest req) {
        return coaches.updateProfile(coach, req);
    }

    @GetMapping("/api/coach/packages")
    @PreAuthorize("hasRole('COACH')")
    public List<CoachDtos.PackageDto> myPackages(@AuthenticationPrincipal User coach) {
        return coaches.myPackages(coach);
    }

    @PostMapping("/api/coach/packages")
    @PreAuthorize("hasRole('COACH')")
    public CoachDtos.PackageDto savePackage(@AuthenticationPrincipal User coach,
                                            @RequestBody CoachDtos.SavePackageRequest req) {
        return coaches.savePackage(coach, req);
    }

    @DeleteMapping("/api/coach/packages/{packageId}")
    @PreAuthorize("hasRole('COACH')")
    public Map<String, Boolean> deletePackage(@AuthenticationPrincipal User coach,
                                              @PathVariable UUID packageId) {
        coaches.deletePackage(coach, packageId);
        return Map.of("ok", true);
    }

    /** Checkout needs to render one offer (price, coach name) before paying. */
    @GetMapping("/api/packages/{packageId}")
    public Map<String, Object> getPackage(@PathVariable UUID packageId) {
        var pkg = coaches.getPackage(packageId);
        return Map.of("pkg", pkg, "coachName", coaches.coachNameOf(pkg.coachId()));
    }
}
