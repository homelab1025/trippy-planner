package com.trippyplanner.auth;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class ResendEmailService {
    private final String apiKey;
    private final String baseUrl;
    private final RestClient restClient;

    public ResendEmailService() {
        // Required for Spring proxy creation
        this.apiKey = null;
        this.baseUrl = null;
        this.restClient = null;
    }

    @Autowired
    public ResendEmailService(
            @Value("${resend.api-key}") String apiKey,
            @Value("${app.base-url}") String baseUrl) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.restClient = RestClient.builder().build();
    }

    public ResendEmailService(String apiKey, String baseUrl, RestClient restClient) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.restClient = restClient;
    }

    public void sendMagicLink(String email, String token) {
        String link = baseUrl + "/auth?token=" + token;
        String body = """
            {"from":"noreply@trippy.app","to":"%s","subject":"Your Trippy Planner sign-in link","text":"Click to sign in: %s\\n\\nThis link is valid for 30 days."}
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
