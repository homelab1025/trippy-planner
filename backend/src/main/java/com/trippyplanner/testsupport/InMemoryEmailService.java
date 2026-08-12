package com.trippyplanner.testsupport;

import com.trippyplanner.auth.EmailService;
import com.trippyplanner.auth.MagicLinkUrlBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Profile({"e2e", "local"})
public class InMemoryEmailService implements EmailService {

    private final Map<String, String> tokensByEmail = new ConcurrentHashMap<>();
    private final Logger logger = LoggerFactory.getLogger(this.getClass());
    private final MagicLinkUrlBuilder magicLinkUrlBuilder;

    public InMemoryEmailService(MagicLinkUrlBuilder magicLinkUrlBuilder) {
        this.magicLinkUrlBuilder = magicLinkUrlBuilder;
        logger.info("Email service initialized: in memory so no emails will be sent.");
    }

    @Override
    public void sendMagicLink(String email, String token) {
        tokensByEmail.put(email, token);
        String link = magicLinkUrlBuilder.build(token);
        logger.info("Send magic link to {} with token {} ({})", email, token, link);
    }

    public Optional<String> findToken(String email) {
        return Optional.ofNullable(tokensByEmail.get(email));
    }
}
