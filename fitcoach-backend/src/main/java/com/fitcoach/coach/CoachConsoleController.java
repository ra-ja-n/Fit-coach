package com.fitcoach.coach;

import com.fitcoach.user.User;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/coach")
@PreAuthorize("hasRole('COACH')")
public class CoachConsoleController {

    private final CoachConsoleService console;

    public CoachConsoleController(CoachConsoleService console) {
        this.console = console;
    }

    @GetMapping("/clients")
    public List<CoachConsoleDtos.CoachClientRow> clients(@AuthenticationPrincipal User coach) {
        return console.clients(coach);
    }

    @GetMapping("/clients/{clientId}")
    public CoachConsoleDtos.ClientDetailBundle clientDetail(@AuthenticationPrincipal User coach,
                                                            @PathVariable UUID clientId) {
        return console.clientDetail(coach, clientId);
    }

    @GetMapping("/revenue")
    public CoachConsoleDtos.RevenueSummary revenue(@AuthenticationPrincipal User coach) {
        return console.revenue(coach);
    }
}
