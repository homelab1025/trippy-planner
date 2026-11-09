package com.trippyplanner.routes.application;

import com.trippyplanner.common.TokenGenerator;
import com.trippyplanner.routes.domain.model.Route;
import com.trippyplanner.routes.domain.model.RouteAccessDeniedException;
import com.trippyplanner.routes.domain.model.RouteNotFoundException;
import com.trippyplanner.routes.domain.model.RouteUpdate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RouteServiceTest {

    private static final long OWNER = 1L;
    private static final long STRANGER = 99L;

    @Mock RouteRepository routeRepository;
    @Mock TokenGenerator tokenGenerator;

    RouteService routeService;
    UUID routeId;

    @BeforeEach
    void setUp() {
        routeService = new RouteService(routeRepository, tokenGenerator);
        routeId = UUID.randomUUID();
    }

    private Route sampleRoute() {
        return new Route(routeId, "My Route", 20.0, OffsetDateTime.now(), false, OffsetDateTime.now(), "<gpx/>", null);
    }

    @Test
    void getReturnsRouteToOwner() {
        when(routeRepository.findById(routeId)).thenReturn(Optional.of(sampleRoute()));
        when(routeRepository.findOwnerUserId(routeId)).thenReturn(Optional.of(OWNER));

        assertThat(routeService.get(OWNER, routeId).id()).isEqualTo(routeId);
    }

    @Test
    void getThrowsNotFoundForMissingRoute() {
        when(routeRepository.findById(routeId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> routeService.get(OWNER, routeId)).isInstanceOf(RouteNotFoundException.class);
    }

    @Test
    void getThrowsAccessDeniedForNonOwner() {
        when(routeRepository.findById(routeId)).thenReturn(Optional.of(sampleRoute()));
        when(routeRepository.findOwnerUserId(routeId)).thenReturn(Optional.of(OWNER));

        assertThatThrownBy(() -> routeService.get(STRANGER, routeId))
            .isInstanceOf(RouteAccessDeniedException.class);
    }

    @Test
    void mutationsCheckOwnershipBeforeTouchingTheRoute() {
        when(routeRepository.findOwnerUserId(routeId)).thenReturn(Optional.of(OWNER));

        assertThatThrownBy(() -> routeService.delete(STRANGER, routeId))
            .isInstanceOf(RouteAccessDeniedException.class);
        assertThatThrownBy(() -> routeService.update(STRANGER, routeId, new RouteUpdate("x", null, null, null)))
            .isInstanceOf(RouteAccessDeniedException.class);
        assertThatThrownBy(() -> routeService.unshare(STRANGER, routeId))
            .isInstanceOf(RouteAccessDeniedException.class);

        verify(routeRepository, never()).delete(any());
        verify(routeRepository, never()).update(any(), any());
        verify(routeRepository, never()).unshare(any());
    }

    @Test
    void mutationsThrowNotFoundForUnknownRoute() {
        when(routeRepository.findOwnerUserId(routeId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> routeService.delete(OWNER, routeId)).isInstanceOf(RouteNotFoundException.class);
    }

    @Test
    void shareReusesExistingToken() {
        when(routeRepository.findOwnerUserId(routeId)).thenReturn(Optional.of(OWNER));
        when(routeRepository.findShareToken(routeId)).thenReturn(Optional.of("existing"));

        assertThat(routeService.share(OWNER, routeId)).isEqualTo("existing");
        verify(routeRepository, never()).share(any(), any());
    }

    @Test
    void shareGeneratesTokenForUnsharedRoute() {
        when(routeRepository.findOwnerUserId(routeId)).thenReturn(Optional.of(OWNER));
        when(routeRepository.findShareToken(routeId)).thenReturn(Optional.empty());
        when(tokenGenerator.generate()).thenReturn("fresh");
        when(routeRepository.share(routeId, "fresh")).thenReturn("fresh");

        assertThat(routeService.share(OWNER, routeId)).isEqualTo("fresh");
    }
}
