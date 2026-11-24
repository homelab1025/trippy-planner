package com.trippyplanner.domain.model;

import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RouteTest {

    private static Route.Builder sample() {
        return Route.builder()
            .id(UUID.randomUUID())
            .ownerId(1L)
            .name("My Route")
            .avgSpeedKmh(20.0)
            .startTime(OffsetDateTime.parse("2026-01-01T08:00:00Z"))
            .createdAt(OffsetDateTime.parse("2026-01-01T07:00:00Z"));
    }

    @Test
    void rejectsMissingRequiredFields() {
        assertThatThrownBy(() -> sample().name(null).build()).isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> sample().startTime(null).build()).isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> sample().id(null).build()).isInstanceOf(NullPointerException.class);
    }

    @Test
    void isPublicFollowsShareToken() {
        Route route = sample().build();
        assertThat(route.isPublic()).isFalse();
        assertThat(route.share("token").isPublic()).isTrue();
        assertThat(route.share("token").unshare().isPublic()).isFalse();
    }

    @Test
    void shareKeepsExistingToken() {
        Route shared = sample().build().share("first");
        assertThat(shared.share("second").shareToken()).isEqualTo("first");
    }

    @Test
    void isOwnedByComparesOwner() {
        Route route = sample().build();
        assertThat(route.isOwnedBy(1L)).isTrue();
        assertThat(route.isOwnedBy(2L)).isFalse();
    }

    @Test
    void editsKeepIdentity() {
        Route route = sample().build();
        Route edited = route.withName("Renamed").withAvgSpeedKmh(25.0).withCheckpointsJson("[]");
        assertThat(edited.hasSameIdentityAs(route)).isTrue();
        assertThat(edited.name()).isEqualTo("Renamed");
    }

    @Test
    void identityChangesAreDetected() {
        Route route = sample().build();
        assertThat(sample().id(UUID.randomUUID()).build().hasSameIdentityAs(route)).isFalse();
        assertThat(route.share("token").hasSameIdentityAs(route)).isFalse();
    }
}
