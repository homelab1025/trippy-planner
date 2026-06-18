package com.trippyplanner.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class ResendEmailService {
    private final String apiKey;
    private final String baseUrl;
    private final RestTemplate restTemplate;

    public ResendEmailService(
            @Value("${resend.api-key}") String apiKey,
            @Value("${app.base-url}") String baseUrl) {
        this(apiKey, baseUrl, new RestTemplate());
    }

    ResendEmailService(String apiKey, String baseUrl, RestTemplate restTemplate) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.restTemplate = restTemplate;
    }

    public void sendMagicLink(String email, String token) {
        String link = baseUrl + "/auth?token=" + token;
        String body = """
            {"from":"noreply@trippy.app","to":"%s","subject":"Your Trippy Planner sign-in link","text":"Click to sign in: %s\\n\\nThis link is valid for 30 days."}
            """.formatted(email, link);

        var headers = new HttpHeaders();
        headers.setBearerAuth(apiKey);
        headers.setContentType(MediaType.APPLICATION_JSON);

        restTemplate.exchange(
            "https://api.resend.com/emails",
            HttpMethod.POST,
            new HttpEntity<>(body, headers),
            String.class
        );
    }
}
