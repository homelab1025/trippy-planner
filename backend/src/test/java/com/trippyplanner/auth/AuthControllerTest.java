package com.trippyplanner.auth;

import com.trippyplanner.model.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
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
class AuthControllerTest {

    @Autowired
    MockMvc mvc;

    @MockBean
    UserRepository userRepository;

    @MockBean
    SessionRepository sessionRepository;

    @MockBean
    com.trippyplanner.common.TokenGenerator tokenGenerator;

    @MockBean
    ResendEmailService emailService;

    @Test
    void requestMagicLinkReturns204() throws Exception {
        when(userRepository.findOrCreate("user@example.com")).thenReturn(1L);
        when(tokenGenerator.generate()).thenReturn("generatedtoken12345");

        mvc.perform(post("/auth/magic-link")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"user@example.com\"}"))
            .andExpect(status().isNoContent());

        verify(emailService).sendMagicLink("user@example.com", "generatedtoken12345");
    }

    @Test
    void getMeReturnsCurrentUser() throws Exception {
        when(userRepository.findEmailById(42L)).thenReturn(Optional.of("me@example.com"));

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

        verify(sessionRepository).delete("mytoken");
    }
}
