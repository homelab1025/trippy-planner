package com.trippyplanner.testsupport;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class InMemoryEmailServiceTest {

    @Test
    void findTokenReturnsEmptyWhenNoMagicLinkSent() {
        var service = new InMemoryEmailService();

        assertThat(service.findToken("nobody@example.com")).isEmpty();
    }

    @Test
    void findTokenReturnsTokenAfterSendMagicLink() {
        var service = new InMemoryEmailService();

        service.sendMagicLink("user@example.com", "abc123");

        assertThat(service.findToken("user@example.com")).contains("abc123");
    }

    @Test
    void sendMagicLinkOverwritesPreviousTokenForSameEmail() {
        var service = new InMemoryEmailService();

        service.sendMagicLink("user@example.com", "old-token");
        service.sendMagicLink("user@example.com", "new-token");

        assertThat(service.findToken("user@example.com")).contains("new-token");
    }
}
