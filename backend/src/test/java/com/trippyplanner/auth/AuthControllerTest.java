package com.trippyplanner.auth;

import com.trippyplanner.common.TokenGenerator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
@TestPropertySource(properties = {
    "app.session-expiry-minutes=43200"
})
@Import(AuthControllerTest.MocksConfig.class)
class AuthControllerTest {

    @Autowired
    MockMvc mvc;

    @Test
    void requestMagicLinkReturns204() throws Exception {
        when(MocksConfig.userRepository.findOrCreate("user@example.com")).thenReturn(1L);
        when(MocksConfig.tokenGenerator.generate()).thenReturn("generatedtoken12345");

        mvc.perform(post("/auth/magic-link")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"user@example.com\"}"))
            .andExpect(status().isNoContent());

        verify(MocksConfig.emailService).sendMagicLink("user@example.com", "generatedtoken12345");
    }

    @Test
    void getMeReturnsCurrentUser() throws Exception {
        when(MocksConfig.userRepository.findEmailById(42L)).thenReturn(Optional.of("me@example.com"));

        mvc.perform(get("/auth/me")
                .requestAttr("userId", 42L))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(42))
            .andExpect(jsonPath("$.email").value("me@example.com"));
    }

    @Test
    void deleteSessionReturns204() throws Exception {
        mvc.perform(delete("/auth/session")
                .requestAttr("sessionToken", "mytoken"))
            .andExpect(status().isNoContent());

        verify(MocksConfig.sessionRepository).delete("mytoken");
    }

    @TestConfiguration
    static class MocksConfig {
        static UserRepository userRepository;
        static SessionRepository sessionRepository;
        static TokenGenerator tokenGenerator;
        static ResendEmailService emailService;

        @Bean
        UserRepository userRepository() {
            userRepository = mock(UserRepository.class);
            return userRepository;
        }

        @Bean
        SessionRepository sessionRepository() {
            sessionRepository = mock(SessionRepository.class);
            return sessionRepository;
        }

        @Bean
        TokenGenerator tokenGenerator() {
            tokenGenerator = mock(TokenGenerator.class);
            return tokenGenerator;
        }

        @Bean
        ResendEmailService emailService() {
            emailService = mock(ResendEmailService.class);
            return emailService;
        }
    }
}
