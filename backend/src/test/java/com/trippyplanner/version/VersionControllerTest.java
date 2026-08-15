package com.trippyplanner.version;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.info.BuildProperties;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(VersionController.class)
@Import(VersionControllerTest.MocksConfig.class)
class VersionControllerTest {

    @Autowired MockMvc mvc;

    @Test
    void returnsVersionAndBuildTime() throws Exception {
        when(MocksConfig.buildProperties.getVersion()).thenReturn("2.2.0");
        when(MocksConfig.buildProperties.getTime()).thenReturn(Instant.parse("2026-08-15T12:00:00Z"));

        mvc.perform(get("/version"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.version").value("2.2.0"))
            .andExpect(jsonPath("$.buildTime").value("2026-08-15T12:00:00Z"));
    }

    @TestConfiguration
    static class MocksConfig {
        static BuildProperties buildProperties;

        @Bean
        BuildProperties buildProperties() {
            buildProperties = mock(BuildProperties.class);
            return buildProperties;
        }
    }
}
