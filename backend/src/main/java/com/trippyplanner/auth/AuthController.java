package com.trippyplanner.auth;

import com.trippyplanner.api.AuthApi;
import com.trippyplanner.auth.api.CurrentUser;
import com.trippyplanner.common.TokenGenerator;
import com.trippyplanner.model.MagicLinkRequest;
import com.trippyplanner.model.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController implements AuthApi {

    private final UserRepository userRepository;
    private final SessionRepository sessionRepository;
    private final TokenGenerator tokenGenerator;
    private final EmailService emailService;
    private final CurrentUser currentUser;
    private final long sessionExpiryMinutes;

    public AuthController(
            UserRepository userRepository,
            SessionRepository sessionRepository,
            TokenGenerator tokenGenerator,
            EmailService emailService,
            CurrentUser currentUser,
            @Value("${app.session-expiry-minutes:43200}") long sessionExpiryMinutes) {
        this.userRepository = userRepository;
        this.sessionRepository = sessionRepository;
        this.tokenGenerator = tokenGenerator;
        this.emailService = emailService;
        this.currentUser = currentUser;
        this.sessionExpiryMinutes = sessionExpiryMinutes;
    }

    @Override
    public ResponseEntity<Void> requestMagicLink(MagicLinkRequest body) {
        long userId = userRepository.findOrCreate(body.getEmail());
        String token = sessionRepository
            .findValidSessionTokenByUserId(userId)
            .orElseGet(() -> {
                String newToken = tokenGenerator.generate();
                sessionRepository.save(newToken, userId, sessionExpiryMinutes);
                return newToken;
            });
        emailService.sendMagicLink(body.getEmail(), token);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<User> getMe() {
        long userId = currentUser.userId();
        String email = userRepository.findEmailById(userId).orElseThrow();
        User user = new User();
        user.setId(userId);
        user.setEmail(email);
        return ResponseEntity.ok(user);
    }

    @Override
    public ResponseEntity<Void> deleteSession() {
        sessionRepository.delete(currentUser.sessionToken());
        return ResponseEntity.noContent().build();
    }
}
