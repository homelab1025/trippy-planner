package com.trippyplanner.auth;

import com.trippyplanner.auth.api.CurrentUser;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.ServletWebRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CurrentUserArgumentResolverTest {

    private final CurrentUserArgumentResolver resolver = new CurrentUserArgumentResolver();

    @Test
    void resolvesUserStoredBySecurityFilter() {
        var request = new MockHttpServletRequest();
        var user = new CurrentUser(42L, "token");
        request.setAttribute(SecurityFilter.CURRENT_USER_ATTRIBUTE, user);

        assertThat(resolver.resolveArgument(null, null, new ServletWebRequest(request), null)).isEqualTo(user);
    }

    @Test
    void failsLoudlyWhenRequestIsUnauthenticated() {
        var webRequest = new ServletWebRequest(new MockHttpServletRequest());

        assertThatThrownBy(() -> resolver.resolveArgument(null, null, webRequest, null))
            .isInstanceOf(IllegalStateException.class);
    }
}
