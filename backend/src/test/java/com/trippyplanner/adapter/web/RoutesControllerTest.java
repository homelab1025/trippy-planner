package com.trippyplanner.adapter.web;

import com.trippyplanner.application.RouteService;
import com.trippyplanner.domain.model.Route;
import com.trippyplanner.domain.model.RouteAccessDeniedException;
import com.trippyplanner.domain.model.RouteNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static com.trippyplanner.adapter.web.AuthenticatedRequests.authenticatedAs;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(RoutesController.class)
@Import(RoutesControllerTest.MocksConfig.class)
class RoutesControllerTest {

    @Autowired MockMvc mvc;

    @BeforeEach
    void setUp() {
        Mockito.reset(MocksConfig.routeService);
    }

    private static Route sampleRoute(UUID id, String checkpointsJson) {
        return Route.builder()
            .id(id)
            .ownerId(1L)
            .name("My Route")
            .avgSpeedKmh(20.0)
            .startTime(OffsetDateTime.now())
            .checkpointsJson(checkpointsJson)
            .createdAt(OffsetDateTime.now())
            .build();
    }

    @Test
    void listRoutesReturns200() throws Exception {
        UUID id = UUID.randomUUID();
        when(MocksConfig.routeService.list(1L)).thenReturn(List.of(sampleRoute(id, null)));

        mvc.perform(get("/routes").with(authenticatedAs(1L)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(id.toString()))
            .andExpect(jsonPath("$[0].name").value("My Route"))
            .andExpect(jsonPath("$[0].gpxContent").doesNotExist());
    }

    @Test
    void getRouteReturns200WhenOwner() throws Exception {
        UUID id = UUID.randomUUID();
        when(MocksConfig.routeService.get(1L, id)).thenReturn(sampleRoute(id, null));
        when(MocksConfig.routeService.getGpx(1L, id)).thenReturn("<gpx/>");

        mvc.perform(get("/routes/{id}", id).with(authenticatedAs(1L)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("My Route"))
            .andExpect(jsonPath("$.gpxContent").value("<gpx/>"))
            .andExpect(jsonPath("$.isPublic").value(false));
    }

    @Test
    void getRouteReturns404WhenMissing() throws Exception {
        UUID id = UUID.randomUUID();
        when(MocksConfig.routeService.get(1L, id)).thenThrow(new RouteNotFoundException(id));

        mvc.perform(get("/routes/{id}", id).with(authenticatedAs(1L)))
            .andExpect(status().isNotFound());
    }

    @Test
    void getRouteReturns403WhenNotOwner() throws Exception {
        UUID id = UUID.randomUUID();
        when(MocksConfig.routeService.get(1L, id)).thenThrow(new RouteAccessDeniedException(id, 1L));

        mvc.perform(get("/routes/{id}", id).with(authenticatedAs(1L)))
            .andExpect(status().isForbidden());
    }

    @Test
    void createRouteReturns201AndPassesThroughCheckpointsJson() throws Exception {
        UUID id = UUID.randomUUID();
        String checkpoints = "[{\"id\":\"end\",\"distanceM\":1000}]";
        when(MocksConfig.routeService.create(eq(1L), any(), eq("<gpx/>"))).thenReturn(sampleRoute(id, checkpoints));

        mvc.perform(post("/routes").with(authenticatedAs(1L))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"My Route\",\"gpxContent\":\"<gpx/>\",\"avgSpeedKmh\":20,"
                    + "\"startTime\":\"2026-01-01T08:00:00Z\","
                    + "\"checkpointsJson\":\"[{\\\"id\\\":\\\"end\\\",\\\"distanceM\\\":1000}]\"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(id.toString()))
            .andExpect(jsonPath("$.checkpointsJson").value(checkpoints))
            .andExpect(jsonPath("$.gpxContent").value("<gpx/>"));

        var captor = org.mockito.ArgumentCaptor.forClass(Route.Builder.class);
        verify(MocksConfig.routeService).create(eq(1L), captor.capture(), eq("<gpx/>"));
        Route details = captor.getValue().id(id).createdAt(OffsetDateTime.now()).build();
        assertThat(details.checkpointsJson()).isEqualTo(checkpoints);
        assertThat(details.avgSpeedKmh()).isEqualTo(20.0);
    }

    @Test
    void updateRouteAppliesOnlyFieldsPresentInTheRequest() throws Exception {
        UUID id = UUID.randomUUID();
        Route stored = sampleRoute(id, "[]");
        when(MocksConfig.routeService.update(eq(1L), eq(id), any()))
            .thenAnswer(inv -> inv.<java.util.function.UnaryOperator<Route>>getArgument(2).apply(stored));
        when(MocksConfig.routeService.getGpx(1L, id)).thenReturn("<gpx/>");

        mvc.perform(put("/routes/{id}", id).with(authenticatedAs(1L))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Renamed\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Renamed"))
            .andExpect(jsonPath("$.avgSpeedKmh").value(20.0))
            .andExpect(jsonPath("$.checkpointsJson").value("[]"))
            .andExpect(jsonPath("$.gpxContent").value("<gpx/>"));
    }

    @Test
    void deleteRouteReturns204() throws Exception {
        UUID id = UUID.randomUUID();

        mvc.perform(delete("/routes/{id}", id).with(authenticatedAs(1L)))
            .andExpect(status().isNoContent());
        verify(MocksConfig.routeService).delete(1L, id);
    }

    @Test
    void shareRouteReturnsToken() throws Exception {
        UUID id = UUID.randomUUID();
        when(MocksConfig.routeService.share(1L, id)).thenReturn("sharetoken12345678");

        mvc.perform(post("/routes/{id}/share", id).with(authenticatedAs(1L)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.shareToken").value("sharetoken12345678"));
    }

    @TestConfiguration
    static class MocksConfig {
        static RouteService routeService;

        @Bean
        RouteService routeService() {
            routeService = mock(RouteService.class);
            return routeService;
        }
    }
}
