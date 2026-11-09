package com.trippyplanner.share.adapter.web;

import com.trippyplanner.routes.api.RouteQueryService;
import com.trippyplanner.routes.api.SharedRoute;
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
        SharedRoute r = new SharedRoute(UUID.randomUUID(), "Shared Route", 20.0, OffsetDateTime.now(),
            OffsetDateTime.now(), "<gpx/>", null);

        when(MocksConfig.routeQueryService.findByShareToken("validtoken")).thenReturn(Optional.of(r));

        mvc.perform(get("/share/validtoken"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Shared Route"))
            .andExpect(jsonPath("$.gpxContent").value("<gpx/>"))
            .andExpect(jsonPath("$.isPublic").value(true));
    }

    @Test
    void returns404ForUnknownToken() throws Exception {
        when(MocksConfig.routeQueryService.findByShareToken("notoken")).thenReturn(Optional.empty());

        mvc.perform(get("/share/notoken"))
            .andExpect(status().isNotFound());
    }

    @TestConfiguration
    static class MocksConfig {
        static RouteQueryService routeQueryService;

        @Bean
        RouteQueryService routeQueryService() {
            routeQueryService = mock(RouteQueryService.class);
            return routeQueryService;
        }
    }
}
