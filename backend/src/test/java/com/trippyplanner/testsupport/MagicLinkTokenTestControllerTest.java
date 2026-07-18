package com.trippyplanner.testsupport;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(MagicLinkTokenTestController.class)
@ActiveProfiles("e2e")
@Import(MagicLinkTokenTestControllerTest.MocksConfig.class)
class MagicLinkTokenTestControllerTest {

    @Autowired
    MockMvc mvc;

    @BeforeEach
    void setUp() {
        Mockito.reset(MocksConfig.emailService);
    }

    @Test
    void returnsTokenWhenFound() throws Exception {
        when(MocksConfig.emailService.findToken("user@example.com")).thenReturn(Optional.of("abc123"));

        mvc.perform(get("/test/magic-link-token").param("email", "user@example.com"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.token").value("abc123"));
    }

    @Test
    void returns404WhenNotFound() throws Exception {
        when(MocksConfig.emailService.findToken("nobody@example.com")).thenReturn(Optional.empty());

        mvc.perform(get("/test/magic-link-token").param("email", "nobody@example.com"))
            .andExpect(status().isNotFound());
    }

    @TestConfiguration
    static class MocksConfig {
        static InMemoryEmailService emailService;

        @Bean
        InMemoryEmailService emailService() {
            emailService = mock(InMemoryEmailService.class);
            return emailService;
        }
    }
}
