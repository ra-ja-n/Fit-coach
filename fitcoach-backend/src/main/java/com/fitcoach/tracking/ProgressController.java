package com.fitcoach.tracking;

import com.fitcoach.user.User;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/progress")
public class ProgressController {

    private final ProgressService progress;

    public ProgressController(ProgressService progress) {
        this.progress = progress;
    }

    /** The client's own history with one coach. */
    @GetMapping
    @PreAuthorize("hasRole('CLIENT')")
    public List<ProgressEntryDto> mine(@AuthenticationPrincipal User client,
                                       @RequestParam UUID coachId) {
        return progress.mine(client, coachId);
    }

    /** Coach view — pair access enforced inside the service. */
    @GetMapping("/client/{clientId}")
    @PreAuthorize("hasRole('COACH')")
    public List<ProgressEntryDto> forClient(@AuthenticationPrincipal User coach,
                                            @PathVariable UUID clientId) {
        return progress.forClient(coach, clientId);
    }

    @PostMapping
    @PreAuthorize("hasRole('CLIENT')")
    public ProgressEntryDto log(@AuthenticationPrincipal User client,
                                @RequestBody ProgressService.LogRequest req) {
        return progress.log(client, req);
    }
}
