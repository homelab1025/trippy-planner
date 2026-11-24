package com.trippyplanner.application;

import com.trippyplanner.domain.model.UserNotFoundException;
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

    /**
     * Returns the id of the user the session belongs to, if the session exists and hasn't expired.
     */
    public Optional<Long> authenticate(String sessionToken) {
        return sessionRepository.findValidUserId(sessionToken);
    }

    public String findEmail(long userId) {
        // A valid session whose user row has gone, e.g. deleted between the session check and this lookup
        return userRepository.findEmailById(userId).orElseThrow(() -> new UserNotFoundException(userId));
    }

    public void signOut(String sessionToken) {
        sessionRepository.delete(sessionToken);
    }
}
