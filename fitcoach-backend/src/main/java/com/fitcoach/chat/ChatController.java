package com.fitcoach.chat;

import com.fitcoach.user.User;
import com.fitcoach.user.UserRole;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * REST surface for chat: history, send, read receipts, inbox.
 * Live delivery rides the STOMP channel (see {@link ChatWebSocketHandler});
 * this controller is what a client falls back to on reconnect.
 */
@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final ChatService chat;

    public ChatController(ChatService chat) {
        this.chat = chat;
    }

    public record PairQuery(UUID coachId, UUID clientId) {}

    @GetMapping
    public List<ChatDtos.ChatMessageDto> history(@AuthenticationPrincipal User actor,
                                                 @RequestParam UUID coachId,
                                                 @RequestParam UUID clientId) {
        return chat.history(actor, coachId, clientId);
    }

    @GetMapping("/context")
    public ChatDtos.ChatContext context(@AuthenticationPrincipal User actor,
                                        @RequestParam UUID coachId,
                                        @RequestParam UUID clientId) {
        return chat.context(actor, coachId, clientId);
    }

    @PostMapping
    public ChatDtos.ChatMessageDto send(@AuthenticationPrincipal User actor,
                                        @RequestBody ChatDtos.SendMessageRequest req) {
        return chat.send(actor, req.coachId(), req.clientId(), req.body());
    }

    @PostMapping("/read")
    public Map<String, Boolean> markRead(@AuthenticationPrincipal User actor,
                                         @RequestBody PairQuery body) {
        chat.markRead(actor, body.coachId(), body.clientId());
        return Map.of("ok", true);
    }

    @GetMapping("/threads")
    @PreAuthorize("hasRole('COACH')")
    public List<ChatDtos.ChatThreadRow> threads(@AuthenticationPrincipal User coach) {
        return chat.threadsForCoach(coach);
    }

    @GetMapping("/summary")
    @PreAuthorize("hasRole('CLIENT')")
    public Map<String, Object> summary(@AuthenticationPrincipal User client) {
        return chat.clientSummary(client);
    }

    /** Convenience: resolves the pair for a caller who only knows one side. */
    public static UUID otherSide(User actor, UUID coachId, UUID clientId) {
        return actor.getRole() == UserRole.coach ? clientId : coachId;
    }
}
