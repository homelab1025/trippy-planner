package com.trippyplanner.adapter.web;

import com.trippyplanner.application.AuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static com.trippyplanner.adapter.web.AuthenticatedRequests.authenticatedAs;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
@Import(AuthControllerTest.MocksConfig.class)
class AuthControllerTest {

    @Autowired
    MockMvc mvc;

    @BeforeEach
    void setUp() {
        Mockito.reset(MocksConfig.authService);
    }

    @Test
    void requestMagicLinkReturns204() throws Exception {
        mvc.perform(post("/auth/magic-link")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"user@example.com\"}"))
            .andExpect(status().isNoContent());

        verify(MocksConfig.authService).requestMagicLink("user@example.com");
    }

    @Test
    void getMeReturnsCurrentUser() throws Exception {
        when(MocksConfig.authService.findEmail(42L))
            .thenReturn("me@example.com");

        mvc.perform(get("/auth/me").with(authenticatedAs(42L)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(42))
            .andExpect(jsonPath("$.email").value("me@example.com"));
    }

    @Test
    void deleteSessionReturns204() throws Exception {
        mvc.perform(delete("/auth/session").with(authenticatedAs(1L, "mytoken")))
            .andExpect(status().isNoContent());

        verify(MocksConfig.authService).signOut("mytoken");
    }

    @TestConfiguration
    static class MocksConfig {
        static AuthService authService;

        @Bean
        AuthService authService() {
            authService = mock(AuthService.class);
            return authService;
        }
    }
}
