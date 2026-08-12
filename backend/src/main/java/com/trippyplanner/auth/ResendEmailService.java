package com.trippyplanner.auth;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
@Profile({"!e2e & !local"})
public class ResendEmailService implements EmailService {
    private final String apiKey;
    private final MagicLinkUrlBuilder magicLinkUrlBuilder;
    private final RestClient restClient;

    @Autowired
    public ResendEmailService(
            @Value("${resend.api-key}") String apiKey,
            MagicLinkUrlBuilder magicLinkUrlBuilder) {
        this.apiKey = apiKey;
        this.magicLinkUrlBuilder = magicLinkUrlBuilder;
        this.restClient = RestClient.builder().build();
    }

    public ResendEmailService(String apiKey, MagicLinkUrlBuilder magicLinkUrlBuilder, RestClient restClient) {
        this.apiKey = apiKey;
        this.magicLinkUrlBuilder = magicLinkUrlBuilder;
        this.restClient = restClient;
    }

    @Override
    public void sendMagicLink(String email, String token) {
        String link = magicLinkUrlBuilder.build(token);
        String body = """
                {"from":"trippy@homelab1025.com","to":"%s","subject":"Your Trippy Planner sign-in link","text":"Click to sign in: %s\\n\\nThis link is valid for 30 days."}
                """.formatted(email, link);

        restClient.post()
                .uri("https://api.resend.com/emails")
                .header("Authorization", "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .toBodilessEntity();
    }
}
