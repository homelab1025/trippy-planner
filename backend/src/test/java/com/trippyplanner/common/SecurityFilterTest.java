package com.trippyplanner.common;

import com.trippyplanner.auth.SessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SecurityFilterTest {

    @Mock
    SessionRepository sessionRepository;

    SecurityFilter filter;

    @BeforeEach
    void setup() {
        filter = new SecurityFilter(sessionRepository);
    }

    @Test
    void allowsMagicLinkWithoutAuth() throws Exception {
        var req = new MockHttpServletRequest("POST", "/api/auth/magic-link");
        var res = new MockHttpServletResponse();
        var chain = new MockFilterChain();

        filter.doFilter(req, res, chain);

        assertThat(res.getStatus()).isEqualTo(200);
        assertThat(chain.getRequest()).isNotNull();
    }

    @Test
    void allowsPublicShareWithoutAuth() throws Exception {
        var req = new MockHttpServletRequest("GET", "/api/share/abc123");
        var res = new MockHttpServletResponse();
        var chain = new MockFilterChain();

        filter.doFilter(req, res, chain);

        assertThat(chain.getRequest()).isNotNull();
    }

    @Test
    void returns401WhenNoAuthHeader() throws Exception {
        var req = new MockHttpServletRequest("GET", "/api/routes");
        var res = new MockHttpServletResponse();
        var chain = new MockFilterChain();

        filter.doFilter(req, res, chain);

        assertThat(res.getStatus()).isEqualTo(401);
        assertThat(chain.getRequest()).isNull();
    }

    @Test
    void returns401ForExpiredToken() throws Exception {
        when(sessionRepository.findValidUserId("expired")).thenReturn(Optional.empty());

        var req = new MockHttpServletRequest("GET", "/api/routes");
        req.addHeader("Authorization", "Bearer expired");
        var res = new MockHttpServletResponse();
        var chain = new MockFilterChain();

        filter.doFilter(req, res, chain);

        assertThat(res.getStatus()).isEqualTo(401);
    }

    @Test
    void setsUserIdAttributeForValidToken() throws Exception {
        when(sessionRepository.findValidUserId("valid-token")).thenReturn(Optional.of(42L));

        var req = new MockHttpServletRequest("GET", "/api/routes");
        req.addHeader("Authorization", "Bearer valid-token");
        var res = new MockHttpServletResponse();
        var chain = new MockFilterChain();

        filter.doFilter(req, res, chain);

        assertThat(chain.getRequest()).isNotNull();
        assertThat(req.getAttribute("userId")).isEqualTo(42L);
        assertThat(req.getAttribute("sessionToken")).isEqualTo("valid-token");
    }
}
