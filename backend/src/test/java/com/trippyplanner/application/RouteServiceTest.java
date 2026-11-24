package com.trippyplanner.application;

import com.trippyplanner.domain.model.Route;
import com.trippyplanner.domain.model.RouteAccessDeniedException;
import com.trippyplanner.domain.model.RouteNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RouteServiceTest {

    private static final long OWNER = 1L;
    private static final long STRANGER = 99L;
    private static final Instant NOW = Instant.parse("2026-11-24T10:00:00.123456789Z");

    @Mock RouteRepository routeRepository;
    @Mock TokenGenerator tokenGenerator;

    RouteService routeService;
    UUID routeId;

    @BeforeEach
    void setUp() {
        routeService = new RouteService(routeRepository, tokenGenerator, Clock.fixed(NOW, ZoneOffset.UTC));
        routeId = UUID.randomUUID();
    }

    private Route sampleRoute() {
        return Route.builder()
            .id(routeId)
            .ownerId(OWNER)
            .name("My Route")
            .avgSpeedKmh(20.0)
            .startTime(OffsetDateTime.parse("2026-01-01T08:00:00Z"))
            .createdAt(OffsetDateTime.parse("2026-01-01T07:00:00Z"))
            .build();
    }

    private static UpdateRouteCommand rename(String name) {
        return new UpdateRouteCommand(name, null, null, null);
    }

    private void stored(Route route) {
        when(routeRepository.findById(routeId)).thenReturn(Optional.of(route));
    }

    @Test
    void createAssignsIdentityOwnerAndCreationTimeItself() {
        when(routeRepository.insert(any(), eq("<gpx/>"))).thenAnswer(inv -> inv.getArgument(0));
        var command = new CreateRouteCommand("New", 18.0, OffsetDateTime.parse("2026-01-01T08:00:00Z"), null);

        Route created = routeService.create(OWNER, command, "<gpx/>");

        assertThat(created.id()).isNotNull();
        assertThat(created.ownerId()).isEqualTo(OWNER);
        assertThat(created.isPublic()).isFalse();
        assertThat(created.createdAt()).isEqualTo(OffsetDateTime.parse("2026-11-24T10:00:00.123456Z"));
        assertThat(created.name()).isEqualTo("New");
    }

    @Test
    void getReturnsRouteToOwner() {
        stored(sampleRoute());

        assertThat(routeService.get(OWNER, routeId).id()).isEqualTo(routeId);
    }

    @Test
    void getThrowsNotFoundForMissingRoute() {
        when(routeRepository.findById(routeId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> routeService.get(OWNER, routeId)).isInstanceOf(RouteNotFoundException.class);
    }

    @Test
    void getThrowsAccessDeniedForNonOwner() {
        stored(sampleRoute());

        assertThatThrownBy(() -> routeService.get(STRANGER, routeId))
            .isInstanceOf(RouteAccessDeniedException.class);
    }

    @Test
    void getGpxChecksOwnership() {
        stored(sampleRoute());

        assertThatThrownBy(() -> routeService.getGpx(STRANGER, routeId))
            .isInstanceOf(RouteAccessDeniedException.class);
        verify(routeRepository, never()).findGpx(any());
    }

    @Test
    void mutationsCheckOwnershipBeforeTouchingTheRoute() {
        stored(sampleRoute().share("token"));

        assertThatThrownBy(() -> routeService.delete(STRANGER, routeId))
            .isInstanceOf(RouteAccessDeniedException.class);
        assertThatThrownBy(() -> routeService.update(STRANGER, routeId, rename("x")))
            .isInstanceOf(RouteAccessDeniedException.class);
        assertThatThrownBy(() -> routeService.unshare(STRANGER, routeId))
            .isInstanceOf(RouteAccessDeniedException.class);

        verify(routeRepository, never()).delete(any());
        verify(routeRepository, never()).update(any());
        verify(routeRepository, never()).updateSharing(any());
    }

    @Test
    void mutationsThrowNotFoundForUnknownRoute() {
        when(routeRepository.findById(routeId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> routeService.delete(OWNER, routeId)).isInstanceOf(RouteNotFoundException.class);
    }

    @Test
    void updateSavesChangedRoute() {
        stored(sampleRoute());
        when(routeRepository.update(any())).thenAnswer(inv -> Optional.of(inv.getArgument(0)));

        Route updated = routeService.update(OWNER, routeId, rename("Renamed"));

        assertThat(updated.name()).isEqualTo("Renamed");
        ArgumentCaptor<Route> saved = ArgumentCaptor.forClass(Route.class);
        verify(routeRepository).update(saved.capture());
        assertThat(saved.getValue().avgSpeedKmh()).isEqualTo(20.0);
    }

    @Test
    void updateWithoutChangesDoesNotWrite() {
        stored(sampleRoute());

        routeService.update(OWNER, routeId, new UpdateRouteCommand(null, null, null, null));
        routeService.update(OWNER, routeId, rename("My Route"));

        verify(routeRepository, never()).update(any());
    }

    @Test
    void updateKeepsSharingState() {
        stored(sampleRoute().share("token"));
        when(routeRepository.update(any())).thenAnswer(inv -> Optional.of(inv.getArgument(0)));

        assertThat(routeService.update(OWNER, routeId, rename("Renamed")).shareToken()).isEqualTo("token");
    }

    @Test
    void shareReusesExistingToken() {
        stored(sampleRoute().share("existing"));

        assertThat(routeService.share(OWNER, routeId)).isEqualTo("existing");
        verify(routeRepository, never()).updateSharing(any());
        verify(tokenGenerator, never()).generate();
    }

    @Test
    void shareGeneratesTokenForUnsharedRoute() {
        stored(sampleRoute());
        when(tokenGenerator.generate()).thenReturn("fresh");
        when(routeRepository.updateSharing(any())).thenAnswer(inv -> Optional.of(inv.getArgument(0)));

        assertThat(routeService.share(OWNER, routeId)).isEqualTo("fresh");
    }

    @Test
    void unshareClearsToken() {
        stored(sampleRoute().share("token"));
        when(routeRepository.updateSharing(any())).thenAnswer(inv -> Optional.of(inv.getArgument(0)));

        routeService.unshare(OWNER, routeId);

        ArgumentCaptor<Route> saved = ArgumentCaptor.forClass(Route.class);
        verify(routeRepository).updateSharing(saved.capture());
        assertThat(saved.getValue().isPublic()).isFalse();
    }

    @Test
    void findSharedGpxLooksUpByToken() {
        when(routeRepository.findByShareToken("token")).thenReturn(Optional.of(sampleRoute().share("token")));
        when(routeRepository.findGpx(routeId)).thenReturn(Optional.of("<gpx/>"));

        assertThat(routeService.findSharedGpx("token")).contains("<gpx/>");
    }
}
