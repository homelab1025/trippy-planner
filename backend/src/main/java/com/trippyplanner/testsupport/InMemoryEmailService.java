package com.trippyplanner.testsupport;

import com.trippyplanner.auth.EmailService;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Profile("e2e")
public class InMemoryEmailService implements EmailService {

    private final Map<String, String> tokensByEmail = new ConcurrentHashMap<>();

    @Override
    public void sendMagicLink(String email, String token) {
        tokensByEmail.put(email, token);
    }

    public Optional<String> findToken(String email) {
        return Optional.ofNullable(tokensByEmail.get(email));
    }
}
