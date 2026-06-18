package com.trippyplanner.auth;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ResendEmailServiceTest {

    @Mock
    RestTemplate restTemplate;

    @Test
    void sendsEmailToResendWithBearerToken() {
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(String.class)))
            .thenReturn(ResponseEntity.ok("{}"));

        var service = new ResendEmailService("re_test_key", "http://localhost:5173", restTemplate);
        service.sendMagicLink("user@example.com", "abc123token");

        var urlCaptor = ArgumentCaptor.forClass(String.class);
        var entityCaptor = ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate).exchange(urlCaptor.capture(), eq(HttpMethod.POST),
            entityCaptor.capture(), eq(String.class));

        assertThat(urlCaptor.getValue()).isEqualTo("https://api.resend.com/emails");
        assertThat(entityCaptor.getValue().getHeaders().getFirst("Authorization"))
            .isEqualTo("Bearer re_test_key");
        assertThat(entityCaptor.getValue().getBody().toString())
            .contains("user@example.com")
            .contains("http://localhost:5173/auth?token=abc123token");
    }
}
