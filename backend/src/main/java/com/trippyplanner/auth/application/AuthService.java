package com.trippyplanner.auth.application;

import com.trippyplanner.auth.api.CurrentUser;
import com.trippyplanner.common.TokenGenerator;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final SessionRepository sessionRepository;
    private final TokenGenerator tokenGenerator;
    private final EmailService emailService;
    private final long sessionExpiryMinutes;

    public AuthService(
            UserRepository userRepository,
            SessionRepository sessionRepository,
            TokenGenerator tokenGenerator,
            EmailService emailService,
            @Value("${app.session-expiry-minutes:43200}") long sessionExpiryMinutes) {
        this.userRepository = userRepository;
        this.sessionRepository = sessionRepository;
        this.tokenGenerator = tokenGenerator;
        this.emailService = emailService;
        this.sessionExpiryMinutes = sessionExpiryMinutes;
    }

    public void requestMagicLink(String email) {
        long userId = userRepository.findOrCreate(email);
        String token = sessionRepository
            .findValidSessionTokenByUserId(userId)
            .orElseGet(() -> {
                String newToken = tokenGenerator.generate();
                sessionRepository.save(newToken, userId, sessionExpiryMinutes);
                return newToken;
            });
        emailService.sendMagicLink(email, token);
    }

    public Optional<CurrentUser> authenticate(String sessionToken) {
        return sessionRepository.findValidUserId(sessionToken)
            .map(userId -> new CurrentUser(userId, sessionToken));
    }

    public String findEmail(CurrentUser currentUser) {
        return userRepository.findEmailById(currentUser.userId()).orElseThrow();
    }

    public void signOut(CurrentUser currentUser) {
        sessionRepository.delete(currentUser.sessionToken());
    }
}
