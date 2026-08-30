package com.fitcoach.admin;

import com.fitcoach.chat.ChatMessageRepository;
import com.fitcoach.coach.CoachProfile;
import com.fitcoach.coach.CoachProfileRepository;
import com.fitcoach.coach.CoachStatus;
import com.fitcoach.common.ApiException;
import com.fitcoach.payment.PaymentRepository;
import com.fitcoach.payment.PaymentStatus;
import com.fitcoach.security.OwnershipGuard;
import com.fitcoach.subscription.SubscriptionRepository;
import com.fitcoach.subscription.SubscriptionStatus;
import com.fitcoach.tracking.ProgressEntryRepository;
import com.fitcoach.auth.RefreshTokenRepository;
import com.fitcoach.user.User;
import com.fitcoach.user.UserRepository;
import com.fitcoach.user.UserRole;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Admin console: approvals, moderation, and read-only support access.
 *
 * Admins can see everything and change nothing private — every write here is
 * about accounts (approve / suspend / force logout), never about a client's
 * plans, progress or messages. OwnershipGuard enforces that boundary; this
 * service never bypasses it.
 */
@Service
public class AdminService {

    private static final Logger secLog = LoggerFactory.getLogger(AdminService.class);

    private final UserRepository users;
    private final CoachProfileRepository coachProfiles;
    private final SubscriptionRepository subscriptions;
    private final PaymentRepository payments;
    private final ProgressEntryRepository progress;
    private final ChatMessageRepository chatMessages;
    private final RefreshTokenRepository refreshTokens;
    private final OwnershipGuard guard;

    public AdminService(UserRepository users, CoachProfileRepository coachProfiles,
                        SubscriptionRepository subscriptions, PaymentRepository payments,
                        ProgressEntryRepository progress, ChatMessageRepository chatMessages,
                        RefreshTokenRepository refreshTokens, OwnershipGuard guard) {
        this.users = users;
        this.coachProfiles = coachProfiles;
        this.subscriptions = subscriptions;
        this.payments = payments;
        this.progress = progress;
        this.chatMessages = chatMessages;
        this.refreshTokens = refreshTokens;
        this.guard = guard;
    }

    @Transactional(readOnly = true)
    public AdminDtos.AdminOverview overview() {
        List<User> all = users.findAll();
        List<CoachProfile> pending = coachProfiles.findByStatus(CoachStatus.pending);

        List<AdminDtos.PendingCoach> pendingRows = pending.stream().map(p -> {
            User u = users.findById(p.getUserId()).orElse(null);
            return new AdminDtos.PendingCoach(p.getUserId(),
                    u == null ? "" : u.getName(),
                    u == null ? "" : u.getEmail(),
                    p.getBio(), List.copyOf(p.getSpecialties()));
        }).toList();

        List<AdminDtos.UserRow> userRows = all.stream()
                .map(u -> new AdminDtos.UserRow(u.getId(), u.getName(), u.getEmail(),
                        u.getRole(), u.isSuspended()))
                .toList();

        List<AdminDtos.PaymentRow> paymentRows = payments
                .findByStatusOrderByCreatedAtDesc(PaymentStatus.captured, PageRequest.of(0, 10)).stream()
                .map(p -> new AdminDtos.PaymentRow(p.getId(),
                        users.findById(p.getClientId()).map(User::getName).orElse(""),
                        users.findById(p.getCoachId()).map(User::getName).orElse(""),
                        p.getAmountCents(), p.getStatus().name(), p.getCreatedAt()))
                .toList();

        return new AdminDtos.AdminOverview(
                new AdminDtos.Stats(all.size(),
                        all.stream().filter(u -> u.getRole() == UserRole.coach).count(),
                        subscriptions.countByStatus(SubscriptionStatus.active),
                        payments.sumAllCaptured()),
                pendingRows, userRows, paymentRows);
    }

    @Transactional
    public void decideCoach(UUID userId, boolean approve) {
        CoachProfile p = coachProfiles.findById(userId).orElseThrow(ApiException::notFound);
        p.setStatus(approve ? CoachStatus.approved : CoachStatus.rejected);
        coachProfiles.save(p);
        secLog.info("admin {} coach {}", approve ? "approved" : "rejected", userId);
    }

    /** Suspending also revokes refresh tokens, so sessions die on next refresh. */
    @Transactional
    public void setSuspended(UUID userId, boolean suspended) {
        User u = users.findById(userId).orElseThrow(ApiException::notFound);
        if (u.getRole() == UserRole.admin) {
            // An admin cannot lock out the admin role through this endpoint.
            throw ApiException.notFound();
        }
        u.setSuspended(suspended);
        users.save(u);
        if (suspended) {
            refreshTokens.revokeAllForUser(userId);
        }
        secLog.info("admin {} user {}", suspended ? "suspended" : "reinstated", userId);
    }

    @Transactional
    public void forceLogout(UUID userId) {
        users.findById(userId).orElseThrow(ApiException::notFound);
        refreshTokens.revokeAllForUser(userId);
        secLog.info("admin force-logout for user {}", userId);
    }

    /** Read-only support view. Writes stay blocked by OwnershipGuard. */
    @Transactional(readOnly = true)
    public AdminDtos.PairView pairView(User admin, UUID coachId, UUID clientId) {
        requireAdmin(admin);
        guard.requirePairAccess(admin, coachId, clientId);
        return new AdminDtos.PairView(
                coachId, clientId,
                users.findById(coachId).map(User::getName).orElse(""),
                users.findById(clientId).map(User::getName).orElse(""),
                subscriptions.findActive(coachId, clientId).isPresent(),
                progress.findByCoachIdAndClientIdOrderByEntryDateDesc(coachId, clientId).size(),
                chatMessages.countByCoachIdAndClientId(coachId, clientId));
    }

    static void requireAdmin(User u) {
        if (u.getRole() != UserRole.admin) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Admins only.");
        }
    }
}
