package com.trippyplanner.routes;

import com.trippyplanner.common.TokenGenerator;
import com.trippyplanner.model.Route;
import com.trippyplanner.model.RouteListItem;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(RoutesController.class)
@TestPropertySource(properties = {
    "app.session-expiry-minutes=43200"
})
@Import(RoutesControllerTest.MocksConfig.class)
class RoutesControllerTest {

    @Autowired MockMvc mvc;

    private Route sampleRoute(UUID id) {
        Route r = new Route();
        r.setId(id);
        r.setName("My Route");
        r.setAvgSpeedKmh(20.0);
        r.setStartTime(OffsetDateTime.now());
        r.setIsPublic(false);
        r.setCreatedAt(OffsetDateTime.now());
        r.setGpxContent("<gpx/>");
        return r;
    }

    @Test
    void listRoutesReturns200() throws Exception {
        when(MocksConfig.routeRepository.findAllByUserId(1L)).thenReturn(List.of(new RouteListItem()));

        mvc.perform(get("/routes").requestAttr("userId", 1L))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());
    }

    @Test
    void getRouteReturns200WhenOwner() throws Exception {
        UUID id = UUID.randomUUID();
        when(MocksConfig.routeRepository.findById(id)).thenReturn(Optional.of(sampleRoute(id)));
        when(MocksConfig.routeRepository.findOwnerUserId(id)).thenReturn(Optional.of(1L));

        mvc.perform(get("/routes/{id}", id).requestAttr("userId", 1L))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("My Route"));
    }

    @Test
    void getRouteReturns403WhenNotOwner() throws Exception {
        UUID id = UUID.randomUUID();
        when(MocksConfig.routeRepository.findById(id)).thenReturn(Optional.of(sampleRoute(id)));
        when(MocksConfig.routeRepository.findOwnerUserId(id)).thenReturn(Optional.of(99L));

        mvc.perform(get("/routes/{id}", id).requestAttr("userId", 1L))
            .andExpect(status().isForbidden());
    }

    @Test
    void createRouteReturns201() throws Exception {
        UUID id = UUID.randomUUID();
        when(MocksConfig.routeRepository.save(eq(1L), any())).thenReturn(sampleRoute(id));

        mvc.perform(post("/routes")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"My Route\",\"gpxContent\":\"<gpx/>\",\"avgSpeedKmh\":20.0,\"startTime\":\"2026-06-17T08:00:00Z\"}")
                .requestAttr("userId", 1L))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(id.toString()));
    }

    @Test
    void deleteRouteReturns204() throws Exception {
        UUID id = UUID.randomUUID();
        when(MocksConfig.routeRepository.findOwnerUserId(id)).thenReturn(Optional.of(1L));

        mvc.perform(delete("/routes/{id}", id).requestAttr("userId", 1L))
            .andExpect(status().isNoContent());
        verify(MocksConfig.routeRepository).delete(id);
    }

    @Test
    void shareRouteReturnsToken() throws Exception {
        UUID id = UUID.randomUUID();
        when(MocksConfig.routeRepository.findOwnerUserId(id)).thenReturn(Optional.of(1L));
        when(MocksConfig.routeRepository.findShareToken(id)).thenReturn(Optional.empty());
        when(MocksConfig.tokenGenerator.generate()).thenReturn("sharetoken12345678");
        when(MocksConfig.routeRepository.share(id, "sharetoken12345678")).thenReturn("sharetoken12345678");

        mvc.perform(post("/routes/{id}/share", id).requestAttr("userId", 1L))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.shareToken").value("sharetoken12345678"));
    }

    @TestConfiguration
    static class MocksConfig {
        static RouteRepository routeRepository;
        static TokenGenerator tokenGenerator;

        @Bean
        RouteRepository routeRepository() {
            routeRepository = mock(RouteRepository.class);
            return routeRepository;
        }

        @Bean
        TokenGenerator tokenGenerator() {
            tokenGenerator = mock(TokenGenerator.class);
            return tokenGenerator;
        }
    }
}
