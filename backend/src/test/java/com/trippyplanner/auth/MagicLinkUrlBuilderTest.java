package com.trippyplanner.auth;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MagicLinkUrlBuilderTest {

    @Test
    void buildsAuthUrlWithTokenFromBaseUrl() {
        var builder = new MagicLinkUrlBuilder("http://localhost:5173");

        assertThat(builder.build("abc123")).isEqualTo("http://localhost:5173/auth?token=abc123");
    }
}
