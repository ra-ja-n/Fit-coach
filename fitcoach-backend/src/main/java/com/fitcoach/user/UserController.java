package com.fitcoach.user;

import com.fitcoach.coach.CoachProfile;
import com.fitcoach.coach.CoachProfileRepository;
import com.fitcoach.common.ApiException;
import com.fitcoach.user.UserRole;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final CoachProfileRepository coachProfiles;

    public UserController(CoachProfileRepository coachProfiles) {
        this.coachProfiles = coachProfiles;
    }

    /** The app routes on role + coachStatus, so /me must carry both. */
    @GetMapping("/me")
    public UserDto me(@AuthenticationPrincipal User user) {
        if (user == null) throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Session expired.");
        String coachStatus = null;
        if (user.getRole() == UserRole.coach) {
            coachStatus = coachProfiles.findById(user.getId())
                    .map(CoachProfile::getStatus)
                    .map(Enum::name)
                    .orElse("pending");
        }
        return UserDto.from(user, coachStatus);
    }
}
