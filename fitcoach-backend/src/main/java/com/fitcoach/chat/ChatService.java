package com.fitcoach.chat;

import com.fitcoach.common.ApiException;
import com.fitcoach.common.RealtimePublisher;
import com.fitcoach.security.OwnershipGuard;
import com.fitcoach.subscription.Subscription;
import com.fitcoach.subscription.SubscriptionRepository;
import com.fitcoach.subscription.SubscriptionStatus;
import com.fitcoach.user.User;
import com.fitcoach.user.UserRepository;
import com.fitcoach.user.UserRole;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Coach <-> client messaging for one pair.
 *
 * Reading a thread needs pair access only (a lapsed client can still see the
 * conversation). Sending is a write and needs an ACTIVE subscription — that is
 * what makes "your plan ended, renew to message your coach" a product rule
 * rather than a bug.
 */
@Service
public class ChatService {

    private static final int MAX_BODY = 2000;

    private final ChatMessageRepository messages;
    private final ChatThreadRepository threads;
    private final SubscriptionRepository subscriptions;
    private final UserRepository users;
    private final OwnershipGuard guard;
    private final RealtimePublisher realtime;

    public ChatService(ChatMessageRepository messages, ChatThreadRepository threads,
                       SubscriptionRepository subscriptions, UserRepository users,
                       OwnershipGuard guard, RealtimePublisher realtime) {
        this.messages = messages;
        this.threads = threads;
        this.subscriptions = subscriptions;
        this.users = users;
        this.guard = guard;
        this.realtime = realtime;
    }

    // ------------------------------------------------------------- reads ---

    @Transactional(readOnly = true)
    public List<ChatDtos.ChatMessageDto> history(User actor, UUID coachId, UUID clientId) {
        guard.requirePairAccess(actor, coachId, clientId);
        return messages.thread(coachId, clientId).stream().map(ChatDtos.ChatMessageDto::from).toList();
    }

    @Transactional(readOnly = true)
    public ChatDtos.ChatContext context(User actor, UUID coachId, UUID clientId) {
        guard.requirePairAccess(actor, coachId, clientId);
        if (!subscriptions.existsByCoachIdAndClientId(coachId, clientId)) {
            throw ApiException.notFound();
        }
        boolean active = subscriptions.findActive(coachId, clientId).isPresent();
        return new ChatDtos.ChatContext(active,
                users.findById(coachId).map(User::getName).orElse(""),
                users.findById(clientId).map(User::getName).orElse(""));
    }

    /** The coach's inbox: one row per client, active pairs first. */
    @Transactional(readOnly = true)
    public List<ChatDtos.ChatThreadRow> threadsForCoach(User coach) {
        if (coach.getRole() != UserRole.coach) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only coaches can do this.");
        }
        List<ChatDtos.ChatThreadRow> rows = new ArrayList<>();
        for (Subscription s : bestSubPerClient(subscriptions.findAllForCoach(coach.getId()))) {
            ChatMessage last = messages
                    .findFirstByCoachIdAndClientIdOrderByCreatedAtDescIdDesc(coach.getId(), s.getClientId())
                    .orElse(null);
            rows.add(new ChatDtos.ChatThreadRow(
                    s.getClientId(),
                    users.findById(s.getClientId()).map(User::getName).orElse(""),
                    s.getStatus() == SubscriptionStatus.active,
                    last == null ? "No messages yet" : last.getBody(),
                    last == null ? null : last.getCreatedAt(),
                    unread(coach.getId(), s.getClientId(), coach.getId())));
        }
        return rows;
    }

    /** Client-side badge: unread count for the client's current coach. */
    @Transactional(readOnly = true)
    public Map<String, Object> clientSummary(User client) {
        if (client.getRole() != UserRole.client) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only clients can do this.");
        }
        Subscription sub = subscriptions.findActiveByClient(client.getId())
                .orElseGet(() -> subscriptions.findAllForClient(client.getId()).stream()
                        .max(Comparator.comparing(Subscription::getEndDate)).orElse(null));
        if (sub == null) {
            return Map.of("hasThread", false, "unread", 0L);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("hasThread", true);
        out.put("unread", unread(sub.getCoachId(), client.getId(), client.getId()));
        out.put("coachId", String.valueOf(sub.getCoachId()));
        return out;
    }

    // ------------------------------------------------------------ writes ---

    /**
     * Persists a message and pushes it to both pair members over STOMP.
     * Called by both the REST controller and the STOMP handler so that a
     * message can never be delivered live without also being stored.
     */
    @Transactional
    public ChatDtos.ChatMessageDto send(User actor, UUID coachId, UUID clientId, String rawBody) {
        guard.requirePairAccess(actor, coachId, clientId);
        guard.requireActiveSubscription(coachId, clientId);

        String body = rawBody == null ? "" : rawBody.trim();
        if (body.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", "Message cannot be empty");
        }
        if (body.length() > MAX_BODY) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", "Message is too long");
        }

        ChatMessage m = new ChatMessage();
        m.setCoachId(coachId);
        m.setClientId(clientId);
        m.setSenderId(actor.getId());
        m.setBody(body);
        ChatMessage saved = messages.save(m);

        // The sender has obviously read what they just wrote.
        ChatThread t = thread(coachId, clientId);
        if (actor.getId().equals(coachId)) t.setLastReadByCoach(saved.getCreatedAt());
        else t.setLastReadByClient(saved.getCreatedAt());
        threads.save(t);

        ChatDtos.ChatMessageDto dto = ChatDtos.ChatMessageDto.from(saved);
        realtime.publishChat(coachId, clientId, dto);
        realtime.publishToPair("chat", coachId, clientId);
        return dto;
    }

    @Transactional
    public void markRead(User actor, UUID coachId, UUID clientId) {
        guard.requirePairAccess(actor, coachId, clientId);
        ChatThread t = thread(coachId, clientId);
        Instant now = Instant.now();
        if (actor.getId().equals(coachId)) t.setLastReadByCoach(now);
        if (actor.getId().equals(clientId)) t.setLastReadByClient(now);
        threads.save(t);
    }

    // ----------------------------------------------------------- helpers ---

    /** Timestamp of the newest message in a thread, or null when empty. */
    @Transactional(readOnly = true)
    public Instant lastMessageAt(UUID coachId, UUID clientId) {
        return messages.findFirstByCoachIdAndClientIdOrderByCreatedAtDescIdDesc(coachId, clientId)
                .map(ChatMessage::getCreatedAt).orElse(null);
    }

    /** Coach-console badge for one client thread. */
    @Transactional(readOnly = true)
    public long unreadForCoach(UUID coachId, UUID clientId) {
        return unread(coachId, clientId, coachId);
    }

    private long unread(UUID coachId, UUID clientId, UUID viewerId) {
        ChatThread t = threads.findByCoachIdAndClientId(coachId, clientId).orElse(null);
        Instant since = t == null ? Instant.EPOCH
                : (viewerId.equals(coachId) ? t.getLastReadByCoach() : t.getLastReadByClient());
        return messages.countUnread(coachId, clientId, viewerId, since);
    }

    private ChatThread thread(UUID coachId, UUID clientId) {
        return threads.findByCoachIdAndClientId(coachId, clientId).orElseGet(() -> {
            ChatThread t = new ChatThread();
            t.setCoachId(coachId);
            t.setClientId(clientId);
            t.setLastReadByCoach(Instant.EPOCH);
            t.setLastReadByClient(Instant.EPOCH);
            return t;
        });
    }

    /**
     * A client may have subscribed several times; the inbox shows one row per
     * client, preferring the active subscription, else the most recent one.
     */
    public static List<Subscription> bestSubPerClient(List<Subscription> subs) {
        Map<UUID, Subscription> best = new LinkedHashMap<>();
        for (Subscription s : subs) {
            Subscription cur = best.get(s.getClientId());
            if (cur == null) {
                best.put(s.getClientId(), s);
                continue;
            }
            boolean curActive = cur.getStatus() == SubscriptionStatus.active;
            boolean sActive = s.getStatus() == SubscriptionStatus.active;
            if (sActive && !curActive) best.put(s.getClientId(), s);
            else if (sActive == curActive && s.getEndDate().isAfter(cur.getEndDate())) {
                best.put(s.getClientId(), s);
            }
        }
        List<Subscription> out = new ArrayList<>(best.values());
        out.sort(Comparator
                .comparing((Subscription s) -> s.getStatus() == SubscriptionStatus.active ? 0 : 1)
                .thenComparing(Subscription::getEndDate, Comparator.reverseOrder()));
        return out;
    }

    /** Latest N messages, oldest last — used by the live chat screen. */
    @Transactional(readOnly = true)
    public List<ChatDtos.ChatMessageDto> recent(User actor, UUID coachId, UUID clientId, int limit) {
        guard.requirePairAccess(actor, coachId, clientId);
        return messages.newestFirst(coachId, clientId, PageRequest.of(0, Math.max(1, Math.min(limit, 200))))
                .stream().map(ChatDtos.ChatMessageDto::from).toList();
    }
}
