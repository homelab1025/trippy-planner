package com.trippyplanner.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class MagicLinkUrlBuilder {
    private final String baseUrl;

    public MagicLinkUrlBuilder(@Value("${app.base-url}") String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String build(String token) {
        return baseUrl + "/auth?token=" + token;
    }
}
