package com.trippyplanner.auth;

import com.trippyplanner.api.AuthApi;
import com.trippyplanner.common.TokenGenerator;
import com.trippyplanner.model.MagicLinkRequest;
import com.trippyplanner.model.User;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController implements AuthApi {

    private final UserRepository userRepository;
    private final SessionRepository sessionRepository;
    private final TokenGenerator tokenGenerator;
    private final ResendEmailService emailService;
    private final HttpServletRequest request;
    private final long sessionExpiryMinutes;

    public AuthController(
            UserRepository userRepository,
            SessionRepository sessionRepository,
            TokenGenerator tokenGenerator,
            ResendEmailService emailService,
            HttpServletRequest request,
            @Value("${app.session-expiry-minutes:43200}") long sessionExpiryMinutes) {
        this.userRepository = userRepository;
        this.sessionRepository = sessionRepository;
        this.tokenGenerator = tokenGenerator;
        this.emailService = emailService;
        this.request = request;
        this.sessionExpiryMinutes = sessionExpiryMinutes;
    }

    @Override
    public ResponseEntity<Void> requestMagicLink(MagicLinkRequest body) {
        long userId = userRepository.findOrCreate(body.getEmail());
        String token = tokenGenerator.generate();
        sessionRepository.save(token, userId, sessionExpiryMinutes);
        emailService.sendMagicLink(body.getEmail(), token);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<User> getMe() {
        long userId = (Long) request.getAttribute("userId");
        String email = userRepository.findEmailById(userId).orElseThrow();
        User user = new User();
        user.setId(userId);
        user.setEmail(email);
        return ResponseEntity.ok(user);
    }

    @Override
    public ResponseEntity<Void> deleteSession() {
        String token = (String) request.getAttribute("sessionToken");
        sessionRepository.delete(token);
        return ResponseEntity.noContent().build();
    }
}
