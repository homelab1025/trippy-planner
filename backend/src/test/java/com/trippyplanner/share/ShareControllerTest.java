package com.trippyplanner.share;

import com.trippyplanner.model.Route;
import com.trippyplanner.routes.RouteRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ShareController.class)
@TestPropertySource(properties = {
    "app.session-expiry-minutes=43200"
})
@Import(ShareControllerTest.MocksConfig.class)
class ShareControllerTest {

    @Autowired MockMvc mvc;

    @Test
    void returnsPublicRoute() throws Exception {
        Route r = new Route();
        r.setId(UUID.randomUUID());
        r.setName("Shared Route");
        r.setAvgSpeedKmh(20.0);
        r.setStartTime(OffsetDateTime.now());
        r.setIsPublic(true);
        r.setCreatedAt(OffsetDateTime.now());
        r.setGpxContent("<gpx/>");

        when(MocksConfig.routeRepository.findByShareToken("validtoken")).thenReturn(Optional.of(r));

        mvc.perform(get("/share/validtoken"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Shared Route"))
            .andExpect(jsonPath("$.gpxContent").value("<gpx/>"));
    }

    @Test
    void returns404ForUnknownToken() throws Exception {
        when(MocksConfig.routeRepository.findByShareToken("notoken")).thenReturn(Optional.empty());

        mvc.perform(get("/share/notoken"))
            .andExpect(status().isNotFound());
    }

    @TestConfiguration
    static class MocksConfig {
        static RouteRepository routeRepository;

        @Bean
        RouteRepository routeRepository() {
            routeRepository = mock(RouteRepository.class);
            return routeRepository;
        }
    }
}
