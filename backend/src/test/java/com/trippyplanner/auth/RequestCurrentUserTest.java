package com.trippyplanner.auth;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RequestCurrentUserTest {

    @Test
    void readsIdentityStoredBySecurityFilter() {
        var request = new MockHttpServletRequest();
        request.setAttribute(RequestCurrentUser.USER_ID_ATTRIBUTE, 42L);
        request.setAttribute(RequestCurrentUser.SESSION_TOKEN_ATTRIBUTE, "token");

        var currentUser = new RequestCurrentUser(request);

        assertThat(currentUser.userId()).isEqualTo(42L);
        assertThat(currentUser.sessionToken()).isEqualTo("token");
    }

    @Test
    void failsLoudlyWhenRequestIsUnauthenticated() {
        var currentUser = new RequestCurrentUser(new MockHttpServletRequest());

        assertThatThrownBy(currentUser::userId).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(currentUser::sessionToken).isInstanceOf(IllegalStateException.class);
    }
}
