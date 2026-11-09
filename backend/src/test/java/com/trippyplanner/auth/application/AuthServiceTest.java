package com.trippyplanner.auth.application;

import com.trippyplanner.auth.api.CurrentUser;
import com.trippyplanner.common.TokenGenerator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private static final long SESSION_EXPIRY_MINUTES = 43200;

    @Mock UserRepository userRepository;
    @Mock SessionRepository sessionRepository;
    @Mock TokenGenerator tokenGenerator;
    @Mock EmailService emailService;

    AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepository, sessionRepository, tokenGenerator, emailService,
            SESSION_EXPIRY_MINUTES);
    }

    @Test
    void requestMagicLinkCreatesSessionWhenNoneIsValid() {
        when(userRepository.findOrCreate("user@example.com")).thenReturn(1L);
        when(sessionRepository.findValidSessionTokenByUserId(1L)).thenReturn(Optional.empty());
        when(tokenGenerator.generate()).thenReturn("generatedtoken12345");

        authService.requestMagicLink("user@example.com");

        verify(sessionRepository).save("generatedtoken12345", 1L, SESSION_EXPIRY_MINUTES);
        verify(emailService).sendMagicLink("user@example.com", "generatedtoken12345");
    }

    @Test
    void requestMagicLinkReusesExistingSession() {
        when(userRepository.findOrCreate("user@example.com")).thenReturn(1L);
        when(sessionRepository.findValidSessionTokenByUserId(1L)).thenReturn(Optional.of("existingtoken67890"));

        authService.requestMagicLink("user@example.com");

        verify(emailService).sendMagicLink("user@example.com", "existingtoken67890");
        verify(sessionRepository, never()).save(any(), anyLong(), anyLong());
    }

    @Test
    void authenticateReturnsUserForValidSession() {
        when(sessionRepository.findValidUserId("valid")).thenReturn(Optional.of(42L));

        assertThat(authService.authenticate("valid")).contains(new CurrentUser(42L, "valid"));
    }

    @Test
    void authenticateReturnsEmptyForUnknownOrExpiredSession() {
        when(sessionRepository.findValidUserId("expired")).thenReturn(Optional.empty());

        assertThat(authService.authenticate("expired")).isEmpty();
    }

    @Test
    void signOutDeletesTheCallersSession() {
        authService.signOut(new CurrentUser(1L, "mytoken"));

        verify(sessionRepository).delete("mytoken");
    }
}
