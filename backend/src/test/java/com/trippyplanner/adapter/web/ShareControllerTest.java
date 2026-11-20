package com.trippyplanner.adapter.web;

import com.trippyplanner.application.RouteService;
import com.trippyplanner.domain.model.Route;
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
        Route r = new Route(UUID.randomUUID(), "Shared Route", 20.0, OffsetDateTime.now(),
            true, OffsetDateTime.now(), "<gpx/>", null);

        when(MocksConfig.routeService.findByShareToken("validtoken")).thenReturn(Optional.of(r));

        mvc.perform(get("/share/validtoken"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Shared Route"))
            .andExpect(jsonPath("$.gpxContent").value("<gpx/>"))
            .andExpect(jsonPath("$.isPublic").value(true));
    }

    @Test
    void returns404ForUnknownToken() throws Exception {
        when(MocksConfig.routeService.findByShareToken("notoken")).thenReturn(Optional.empty());

        mvc.perform(get("/share/notoken"))
            .andExpect(status().isNotFound());
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
