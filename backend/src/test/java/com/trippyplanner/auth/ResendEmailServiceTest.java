package com.trippyplanner.auth;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ResendEmailServiceTest {

    @Test
    void createsServiceWithRestClient() {
        RestClient restClient = mock(RestClient.class);
        var service = new ResendEmailService("re_test_key", "http://localhost:5173", restClient);
        assertThat(service).isNotNull();
    }
}
