package com.trippyplanner.auth.adapter.web;

import com.trippyplanner.auth.api.CurrentUser;
import com.trippyplanner.auth.application.AuthService;
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
    AuthService authService;

    SecurityFilter filter;

    @BeforeEach
    void setup() {
        filter = new SecurityFilter(authService);
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
    void allowsMagicLinkTokenTestEndpointWithoutAuth() throws Exception {
        var req = new MockHttpServletRequest("GET", "/api/test/magic-link-token");
        var res = new MockHttpServletResponse();
        var chain = new MockFilterChain();

        filter.doFilter(req, res, chain);

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
    void allowsVersionWithoutAuth() throws Exception {
        var req = new MockHttpServletRequest("GET", "/api/version");
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
        when(authService.authenticate("expired")).thenReturn(Optional.empty());

        var req = new MockHttpServletRequest("GET", "/api/routes");
        req.addHeader("Authorization", "Bearer expired");
        var res = new MockHttpServletResponse();
        var chain = new MockFilterChain();

        filter.doFilter(req, res, chain);

        assertThat(res.getStatus()).isEqualTo(401);
    }

    @Test
    void setsCurrentUserForValidToken() throws Exception {
        when(authService.authenticate("valid-token")).thenReturn(Optional.of(new CurrentUser(42L, "valid-token")));

        var req = new MockHttpServletRequest("GET", "/api/routes");
        req.addHeader("Authorization", "Bearer valid-token");
        var res = new MockHttpServletResponse();
        var chain = new MockFilterChain();

        filter.doFilter(req, res, chain);

        assertThat(chain.getRequest()).isNotNull();
        assertThat(req.getAttribute(SecurityFilter.CURRENT_USER_ATTRIBUTE))
            .isEqualTo(new CurrentUser(42L, "valid-token"));
    }
}
