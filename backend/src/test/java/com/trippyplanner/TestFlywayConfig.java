package com.trippyplanner;

import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

@TestConfiguration
public class TestFlywayConfig implements SmartInitializingSingleton {

    private final DataSource dataSource;

    public TestFlywayConfig(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Bean
    public Flyway flyway(DataSource dataSource) {
        return Flyway.configure()
                .dataSource(dataSource)
                .load();
    }

    @Override
    public void afterSingletonsInstantiated() {
        Flyway.configure()
                .dataSource(dataSource)
                .load()
                .migrate();
    }
}
