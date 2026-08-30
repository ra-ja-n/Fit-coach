package com.fitcoach.plan;

import com.fitcoach.user.User;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** The coach's template library. */
@RestController
@RequestMapping("/api/plan-templates")
@PreAuthorize("hasRole('COACH')")
public class PlanTemplateController {

    private final PlanTemplateService templates;

    public PlanTemplateController(PlanTemplateService templates) {
        this.templates = templates;
    }

    public record AssignBody(UUID clientId) {}

    @GetMapping
    public List<PlanTemplateDto> list(@AuthenticationPrincipal User coach) {
        return templates.list(coach);
    }

    @PostMapping
    public PlanTemplateDto save(@AuthenticationPrincipal User coach,
                                @RequestBody PlanTemplateService.SaveTemplateRequest req) {
        return templates.save(coach, req);
    }

    @DeleteMapping("/{templateId}")
    public Map<String, Boolean> delete(@AuthenticationPrincipal User coach,
                                       @PathVariable UUID templateId) {
        templates.delete(coach, templateId);
        return Map.of("ok", true);
    }

    @PostMapping("/{templateId}/assign")
    public Map<String, Boolean> assign(@AuthenticationPrincipal User coach,
                                       @PathVariable UUID templateId,
                                       @RequestBody AssignBody body) {
        templates.assign(coach, templateId, body.clientId());
        return Map.of("ok", true);
    }
}
