# Backend API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Spring Boot native backend: Flyway migrations, token-based auth (magic link via Resend), route CRUD, and public sharing.

**Architecture:** Spring Boot 3.4 generates controller interfaces from `openapi.yaml` at compile time. Developer-written classes implement those interfaces. A servlet filter validates `Authorization: Bearer <token>` against the `sessions` table and injects `userId` and `sessionToken` as request attributes. JdbcTemplate with raw SQL for all DB access. Flyway manages schema.

**Tech Stack:** Java 21, Spring Boot 3.4, Spring JDBC (JdbcTemplate), Flyway, PostgreSQL 17, OpenAPI Generator Maven Plugin (spring generator), Resend (HTTP via RestTemplate), GraalVM native-image, TestContainers (PostgreSQL for repository tests), MockMvc (controller tests)

**Prerequisite:** The monorepo restructure plan must be complete — `openapi.yaml` must exist at the repo root.

---

### Task 1: Create Spring Boot project skeleton

**Files:**
- Create: `backend/pom.xml`
- Create: `backend/src/main/java/com/trippyplanner/TrippyPlannerApplication.java`
- Create: `backend/src/main/resources/application.yml`
- Create: `backend/Dockerfile`
- Create: `backend/.gitignore`

- [ ] **Step 1: Generate the project skeleton**

Go to https://start.spring.io and download a project with:
- Maven, Java 21, Spring Boot 3.4.x
- Dependencies: Spring Web, JDBC API, PostgreSQL Driver, Flyway Migration
- Artifact: `backend`, Group: `com.trippyplanner`

Alternatively, bootstrap manually from Step 2 onward.

- [ ] **Step 2: Write `backend/pom.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.4.1</version>
    <relativePath/>
  </parent>

  <groupId>com.trippyplanner</groupId>
  <artifactId>backend</artifactId>
  <version>1.0.0-SNAPSHOT</version>

  <properties>
    <java.version>21</java.version>
    <openapi-generator.version>7.10.0</openapi-generator.version>
  </properties>

  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-jdbc</artifactId>
    </dependency>
    <dependency>
      <groupId>org.postgresql</groupId>
      <artifactId>postgresql</artifactId>
      <scope>runtime</scope>
    </dependency>
    <dependency>
      <groupId>org.flywaydb</groupId>
      <artifactId>flyway-core</artifactId>
    </dependency>
    <dependency>
      <groupId>org.flywaydb</groupId>
      <artifactId>flyway-database-postgresql</artifactId>
    </dependency>
    <!-- Required by generated OpenAPI code -->
    <dependency>
      <groupId>org.springdoc</groupId>
      <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
      <version>2.7.0</version>
    </dependency>
    <dependency>
      <groupId>org.openapitools</groupId>
      <artifactId>jackson-databind-nullable</artifactId>
      <version>0.2.6</version>
    </dependency>
    <!-- Test -->
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-test</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-testcontainers</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.testcontainers</groupId>
      <artifactId>postgresql</artifactId>
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.graalvm.buildtools</groupId>
        <artifactId>native-maven-plugin</artifactId>
      </plugin>
      <plugin>
        <groupId>org.openapitools</groupId>
        <artifactId>openapi-generator-maven-plugin</artifactId>
        <version>${openapi-generator.version}</version>
        <executions>
          <execution>
            <goals><goal>generate</goal></goals>
            <configuration>
              <inputSpec>${project.basedir}/../openapi.yaml</inputSpec>
              <generatorName>spring</generatorName>
              <apiPackage>com.trippyplanner.api</apiPackage>
              <modelPackage>com.trippyplanner.model</modelPackage>
              <configOptions>
                <interfaceOnly>true</interfaceOnly>
                <useSpringBoot3>true</useSpringBoot3>
                <useTags>true</useTags>
                <dateLibrary>java8</dateLibrary>
                <openApiNullable>false</openApiNullable>
              </configOptions>
            </configuration>
          </execution>
        </executions>
      </plugin>
    </plugins>
  </build>
</project>
```

- [ ] **Step 3: Write `backend/src/main/java/com/trippyplanner/TrippyPlannerApplication.java`**

```java
package com.trippyplanner;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class TrippyPlannerApplication {
    public static void main(String[] args) {
        SpringApplication.run(TrippyPlannerApplication.class, args);
    }
}
```

- [ ] **Step 4: Write `backend/src/main/resources/application.yml`**

```yaml
spring:
  datasource:
    url: ${SPRING_DATASOURCE_URL}
    username: ${SPRING_DATASOURCE_USERNAME}
    password: ${SPRING_DATASOURCE_PASSWORD}
  flyway:
    enabled: true

server:
  servlet:
    context-path: /api

app:
  base-url: ${APP_BASE_URL}
  session-expiry-minutes: ${SESSION_EXPIRY_MINUTES:43200}

resend:
  api-key: ${RESEND_API_KEY}
```

- [ ] **Step 5: Write `backend/Dockerfile`**

```dockerfile
FROM ghcr.io/graalvm/native-image-community:21 AS build
WORKDIR /app
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN ./mvnw dependency:go-offline -q
COPY src ./src
RUN ./mvnw -Pnative native:compile -q

FROM gcr.io/distroless/base-debian12
COPY --from=build /app/target/backend /app/backend
ENTRYPOINT ["/app/backend"]
```

- [ ] **Step 6: Write `backend/.gitignore`**

```
target/
.mvn/wrapper/maven-wrapper.jar
```

- [ ] **Step 7: Run generate-sources to verify OpenAPI generation**

```bash
cd backend && ./mvnw generate-sources
```

Expected: `target/generated-sources/openapi/` contains `AuthApi.java`, `RoutesApi.java`, `ShareApi.java`, and model classes. No compilation errors.

- [ ] **Step 8: Compile the project**

```bash
cd backend && ./mvnw compile
```

Expected: `BUILD SUCCESS`.

- [ ] **Step 9: Commit**

```bash
git add backend/
git commit -m "feat: add Spring Boot backend skeleton with OpenAPI code generation"
```

---

### Task 2: Flyway migrations

**Files:**
- Create: `backend/src/main/resources/db/migration/V1__create_users.sql`
- Create: `backend/src/main/resources/db/migration/V2__create_sessions.sql`
- Create: `backend/src/main/resources/db/migration/V3__create_routes.sql`
- Create: `backend/src/main/resources/db/migration/V4__indexes.sql`

Flyway runs these automatically on startup in version order. File names must follow the pattern `V{version}__{description}.sql`.

- [ ] **Step 1: Write `V1__create_users.sql`**

```sql
CREATE TABLE users (
  id         BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email      TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Write `V2__create_sessions.sql`**

```sql
-- Session token IS the magic link (see spec security note).
-- Token is a 20-character random URL-safe string.
CREATE TABLE sessions (
  token      TEXT        PRIMARY KEY,
  user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 3: Write `V3__create_routes.sql`**

```sql
-- gpx_content stores the raw GPX XML. Immutable after creation.
-- share_token is NULL when private; a 20-char token when public.
CREATE TABLE routes (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT         NOT NULL,
  gpx_content   TEXT         NOT NULL,
  avg_speed_kmh NUMERIC(5,2) NOT NULL,
  start_time    TIMESTAMPTZ  NOT NULL,
  is_public     BOOLEAN      NOT NULL DEFAULT false,
  share_token   TEXT         UNIQUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```

- [ ] **Step 4: Write `V4__indexes.sql`**

```sql
CREATE INDEX ON sessions(user_id);
CREATE INDEX ON sessions(expires_at);
CREATE INDEX ON routes(user_id);
```

- [ ] **Step 5: Write a migration test using TestContainers**

Create `backend/src/test/java/com/trippyplanner/MigrationTest.java`:

```java
package com.trippyplanner;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers
class MigrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17");

    @Test
    void contextLoads() {
        // If migrations fail, context startup fails and this test fails.
    }
}
```

Create `backend/src/test/resources/application.yml` to override env vars for tests:

```yaml
app:
  base-url: http://localhost:5173
  session-expiry-minutes: 43200
resend:
  api-key: test-key
```

- [ ] **Step 6: Run the migration test**

```bash
cd backend && ./mvnw test -Dtest=MigrationTest
```

Expected: `BUILD SUCCESS`. If Docker is not running, start it first — TestContainers requires Docker.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/resources/db/ backend/src/test/
git commit -m "feat: add Flyway SQL migrations and migration smoke test"
```

---

### Task 3: TokenGenerator

**Files:**
- Create: `backend/src/main/java/com/trippyplanner/common/TokenGenerator.java`
- Create: `backend/src/test/java/com/trippyplanner/common/TokenGeneratorTest.java`

- [ ] **Step 1: Write the failing test**

```java
package com.trippyplanner.common;

import org.junit.jupiter.api.Test;
import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class TokenGeneratorTest {

    private final TokenGenerator generator = new TokenGenerator();

    @Test
    void generatesTokenOfExpectedLength() {
        String token = generator.generate();
        assertThat(token).hasSize(20);
    }

    @Test
    void generatesOnlyUrlSafeCharacters() {
        String token = generator.generate();
        assertThat(token).matches("[A-Za-z0-9]+");
    }

    @Test
    void generatesDifferentTokensEachTime() {
        Set<String> tokens = new HashSet<>();
        for (int i = 0; i < 100; i++) {
            tokens.add(generator.generate());
        }
        assertThat(tokens).hasSize(100);
    }
}
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend && ./mvnw test -Dtest=TokenGeneratorTest
```

Expected: FAIL — `TokenGenerator` not found.

- [ ] **Step 3: Write the implementation**

```java
package com.trippyplanner.common;

import org.springframework.stereotype.Component;
import java.security.SecureRandom;

@Component
public class TokenGenerator {
    private static final String ALPHABET =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    private static final int LENGTH = 20;
    private final SecureRandom random = new SecureRandom();

    public String generate() {
        StringBuilder sb = new StringBuilder(LENGTH);
        for (int i = 0; i < LENGTH; i++) {
            sb.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && ./mvnw test -Dtest=TokenGeneratorTest
```

Expected: `BUILD SUCCESS`, 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/trippyplanner/common/TokenGenerator.java \
        backend/src/test/java/com/trippyplanner/common/TokenGeneratorTest.java
git commit -m "feat: add TokenGenerator using SecureRandom"
```

---

### Task 4: UserRepository and SessionRepository

**Files:**
- Create: `backend/src/main/java/com/trippyplanner/auth/UserRepository.java`
- Create: `backend/src/main/java/com/trippyplanner/auth/SessionRepository.java`
- Create: `backend/src/test/java/com/trippyplanner/auth/UserRepositoryTest.java`
- Create: `backend/src/test/java/com/trippyplanner/auth/SessionRepositoryTest.java`

- [ ] **Step 1: Write `UserRepositoryTest.java`**

```java
package com.trippyplanner.auth;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.JdbcTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.jdbc.Sql;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

@JdbcTest
@Testcontainers
@Import(UserRepository.class)
class UserRepositoryTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17");

    @Autowired
    UserRepository repo;

    @Test
    void createsNewUserIfEmailUnknown() {
        long id = repo.findOrCreate("new@example.com");
        assertThat(id).isPositive();
    }

    @Test
    void returnsExistingUserIfEmailKnown() {
        long first = repo.findOrCreate("existing@example.com");
        long second = repo.findOrCreate("existing@example.com");
        assertThat(first).isEqualTo(second);
    }

    @Test
    void findsEmailByUserId() {
        long id = repo.findOrCreate("find@example.com");
        assertThat(repo.findEmailById(id)).contains("find@example.com");
    }

    @Test
    void returnsEmptyForUnknownUserId() {
        assertThat(repo.findEmailById(99999L)).isEmpty();
    }
}
```

Note: `@JdbcTest` starts Flyway automatically when it finds migration files on the classpath.

- [ ] **Step 2: Write `SessionRepositoryTest.java`**

```java
package com.trippyplanner.auth;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.JdbcTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

@JdbcTest
@Testcontainers
@Import({UserRepository.class, SessionRepository.class})
class SessionRepositoryTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17");

    @Autowired
    SessionRepository sessionRepo;

    @Autowired
    UserRepository userRepo;

    long userId;

    @BeforeEach
    void setup() {
        userId = userRepo.findOrCreate("session-test@example.com");
    }

    @Test
    void savesAndFindsValidSession() {
        sessionRepo.save("token123", userId, 43200);
        assertThat(sessionRepo.findValidUserId("token123")).contains(userId);
    }

    @Test
    void returnsEmptyForUnknownToken() {
        assertThat(sessionRepo.findValidUserId("no-such-token")).isEmpty();
    }

    @Test
    void deletesSession() {
        sessionRepo.save("to-delete", userId, 43200);
        sessionRepo.delete("to-delete");
        assertThat(sessionRepo.findValidUserId("to-delete")).isEmpty();
    }
}
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend && ./mvnw test -Dtest=UserRepositoryTest,SessionRepositoryTest
```

Expected: FAIL — classes not found.

- [ ] **Step 4: Write `UserRepository.java`**

```java
package com.trippyplanner.auth;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class UserRepository {
    private final JdbcTemplate jdbc;

    public UserRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public long findOrCreate(String email) {
        List<Long> existing = jdbc.queryForList(
            "SELECT id FROM users WHERE email = ?", Long.class, email);
        if (!existing.isEmpty()) {
            return existing.get(0);
        }
        Long id = jdbc.queryForObject(
            "INSERT INTO users (email) VALUES (?) RETURNING id", Long.class, email);
        return id;
    }

    public Optional<String> findEmailById(long userId) {
        List<String> results = jdbc.queryForList(
            "SELECT email FROM users WHERE id = ?", String.class, userId);
        return results.stream().findFirst();
    }
}
```

- [ ] **Step 5: Write `SessionRepository.java`**

```java
package com.trippyplanner.auth;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class SessionRepository {
    private final JdbcTemplate jdbc;

    public SessionRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void save(String token, long userId, long expiryMinutes) {
        jdbc.update(
            "INSERT INTO sessions (token, user_id, expires_at) " +
            "VALUES (?, ?, now() + (? || ' minutes')::interval)",
            token, userId, expiryMinutes);
    }

    public Optional<Long> findValidUserId(String token) {
        List<Long> results = jdbc.queryForList(
            "SELECT user_id FROM sessions WHERE token = ? AND expires_at > now()",
            Long.class, token);
        return results.stream().findFirst();
    }

    public void delete(String token) {
        jdbc.update("DELETE FROM sessions WHERE token = ?", token);
    }
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd backend && ./mvnw test -Dtest=UserRepositoryTest,SessionRepositoryTest
```

Expected: `BUILD SUCCESS`, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/trippyplanner/auth/ \
        backend/src/test/java/com/trippyplanner/auth/
git commit -m "feat: add UserRepository and SessionRepository with JdbcTemplate"
```

---

### Task 5: SecurityFilter

**Files:**
- Create: `backend/src/main/java/com/trippyplanner/common/SecurityFilter.java`
- Create: `backend/src/test/java/com/trippyplanner/common/SecurityFilterTest.java`

The filter runs on every request. Public paths (`/api/auth/magic-link` and `/api/share/*`) skip auth. All others require `Authorization: Bearer <token>` with a valid session.

- [ ] **Step 1: Write `SecurityFilterTest.java`**

```java
package com.trippyplanner.common;

import com.trippyplanner.auth.SessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SecurityFilterTest {

    @Mock
    SessionRepository sessionRepository;

    SecurityFilter filter;

    @BeforeEach
    void setup() {
        filter = new SecurityFilter(sessionRepository);
    }

    @Test
    void allowsMagicLinkWithoutAuth() throws Exception {
        var req = new MockHttpServletRequest("POST", "/api/auth/magic-link");
        var res = new MockHttpServletResponse();
        var chain = new MockFilterChain();

        filter.doFilter(req, res, chain);

        assertThat(res.getStatus()).isEqualTo(200);
        assertThat(chain.getRequest()).isNotNull();
    }

    @Test
    void allowsPublicShareWithoutAuth() throws Exception {
        var req = new MockHttpServletRequest("GET", "/api/share/abc123");
        var res = new MockHttpServletResponse();
        var chain = new MockFilterChain();

        filter.doFilter(req, res, chain);

        assertThat(chain.getRequest()).isNotNull();
    }

    @Test
    void returns401WhenNoAuthHeader() throws Exception {
        var req = new MockHttpServletRequest("GET", "/api/routes");
        var res = new MockHttpServletResponse();
        var chain = new MockFilterChain();

        filter.doFilter(req, res, chain);

        assertThat(res.getStatus()).isEqualTo(401);
        assertThat(chain.getRequest()).isNull();
    }

    @Test
    void returns401ForExpiredToken() throws Exception {
        when(sessionRepository.findValidUserId("expired")).thenReturn(Optional.empty());

        var req = new MockHttpServletRequest("GET", "/api/routes");
        req.addHeader("Authorization", "Bearer expired");
        var res = new MockHttpServletResponse();
        var chain = new MockFilterChain();

        filter.doFilter(req, res, chain);

        assertThat(res.getStatus()).isEqualTo(401);
    }

    @Test
    void setsUserIdAttributeForValidToken() throws Exception {
        when(sessionRepository.findValidUserId("valid-token")).thenReturn(Optional.of(42L));

        var req = new MockHttpServletRequest("GET", "/api/routes");
        req.addHeader("Authorization", "Bearer valid-token");
        var res = new MockHttpServletResponse();
        var chain = new MockFilterChain();

        filter.doFilter(req, res, chain);

        assertThat(chain.getRequest()).isNotNull();
        assertThat(req.getAttribute("userId")).isEqualTo(42L);
        assertThat(req.getAttribute("sessionToken")).isEqualTo("valid-token");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && ./mvnw test -Dtest=SecurityFilterTest
```

Expected: FAIL — `SecurityFilter` not found.

- [ ] **Step 3: Write `SecurityFilter.java`**

Do NOT annotate with `@Component`. Register via `FilterConfig` (Step 3b) so `@WebMvcTest` controller tests don't load it — `@WebMvcTest` loads `Filter` beans but NOT `FilterRegistrationBean` factories.

```java
package com.trippyplanner.common;

import com.trippyplanner.auth.SessionRepository;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Optional;

public class SecurityFilter implements Filter {

    private final SessionRepository sessionRepository;

    public SecurityFilter(SessionRepository sessionRepository) {
        this.sessionRepository = sessionRepository;
    }

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        var request = (HttpServletRequest) req;
        var response = (HttpServletResponse) res;

        String uri = request.getRequestURI();
        boolean isPublic = uri.endsWith("/auth/magic-link") || uri.startsWith("/api/share/");

        if (isPublic || "OPTIONS".equals(request.getMethod())) {
            chain.doFilter(req, res);
            return;
        }

        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            return;
        }

        String token = authHeader.substring(7);
        Optional<Long> userId = sessionRepository.findValidUserId(token);

        if (userId.isEmpty()) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            return;
        }

        request.setAttribute("userId", userId.get());
        request.setAttribute("sessionToken", token);
        chain.doFilter(req, res);
    }
}
```

- [ ] **Step 3b: Write `FilterConfig.java` to register the filter**

```java
package com.trippyplanner.common;

import com.trippyplanner.auth.SessionRepository;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FilterConfig {

    @Bean
    public FilterRegistrationBean<SecurityFilter> securityFilter(SessionRepository sessionRepository) {
        FilterRegistrationBean<SecurityFilter> bean = new FilterRegistrationBean<>();
        bean.setFilter(new SecurityFilter(sessionRepository));
        bean.addUrlPatterns("/*");
        bean.setOrder(1);
        return bean;
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && ./mvnw test -Dtest=SecurityFilterTest
```

Expected: `BUILD SUCCESS`, 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/trippyplanner/common/SecurityFilter.java \
        backend/src/main/java/com/trippyplanner/common/FilterConfig.java \
        backend/src/test/java/com/trippyplanner/common/SecurityFilterTest.java
git commit -m "feat: add SecurityFilter for Bearer token validation"
```

---

### Task 6: ResendEmailService

**Files:**
- Create: `backend/src/main/java/com/trippyplanner/auth/ResendEmailService.java`
- Create: `backend/src/test/java/com/trippyplanner/auth/ResendEmailServiceTest.java`

- [ ] **Step 1: Write `ResendEmailServiceTest.java`**

```java
package com.trippyplanner.auth;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ResendEmailServiceTest {

    @Mock
    RestTemplate restTemplate;

    @Test
    void sendsEmailToResendWithBearerToken() {
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(String.class)))
            .thenReturn(ResponseEntity.ok("{}"));

        var service = new ResendEmailService("re_test_key", "http://localhost:5173", restTemplate);
        service.sendMagicLink("user@example.com", "abc123token");

        var urlCaptor = ArgumentCaptor.forClass(String.class);
        var entityCaptor = ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate).exchange(urlCaptor.capture(), eq(HttpMethod.POST),
            entityCaptor.capture(), eq(String.class));

        assertThat(urlCaptor.getValue()).isEqualTo("https://api.resend.com/emails");
        assertThat(entityCaptor.getValue().getHeaders().getFirst("Authorization"))
            .isEqualTo("Bearer re_test_key");
        assertThat(entityCaptor.getValue().getBody().toString())
            .contains("user@example.com")
            .contains("http://localhost:5173/auth?token=abc123token");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && ./mvnw test -Dtest=ResendEmailServiceTest
```

Expected: FAIL — `ResendEmailService` not found.

- [ ] **Step 3: Write `ResendEmailService.java`**

```java
package com.trippyplanner.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class ResendEmailService {
    private final String apiKey;
    private final String baseUrl;
    private final RestTemplate restTemplate;

    public ResendEmailService(
            @Value("${resend.api-key}") String apiKey,
            @Value("${app.base-url}") String baseUrl) {
        this(apiKey, baseUrl, new RestTemplate());
    }

    ResendEmailService(String apiKey, String baseUrl, RestTemplate restTemplate) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.restTemplate = restTemplate;
    }

    public void sendMagicLink(String email, String token) {
        String link = baseUrl + "/auth?token=" + token;
        String body = """
            {"from":"noreply@trippy.app","to":"%s","subject":"Your Trippy Planner sign-in link","text":"Click to sign in: %s\\n\\nThis link is valid for 30 days."}
            """.formatted(email, link);

        var headers = new HttpHeaders();
        headers.setBearerAuth(apiKey);
        headers.setContentType(MediaType.APPLICATION_JSON);

        restTemplate.exchange(
            "https://api.resend.com/emails",
            HttpMethod.POST,
            new HttpEntity<>(body, headers),
            String.class
        );
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && ./mvnw test -Dtest=ResendEmailServiceTest
```

Expected: `BUILD SUCCESS`, 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/trippyplanner/auth/ResendEmailService.java \
        backend/src/test/java/com/trippyplanner/auth/ResendEmailServiceTest.java
git commit -m "feat: add ResendEmailService for magic link email delivery"
```

---

### Task 7: AuthController

**Files:**
- Create: `backend/src/main/java/com/trippyplanner/auth/AuthController.java`
- Create: `backend/src/test/java/com/trippyplanner/auth/AuthControllerTest.java`

The generated `AuthApi` interface defines three methods. The controller implements them and reads `userId`/`sessionToken` from request attributes set by `SecurityFilter`.

- [ ] **Step 1: Write `AuthControllerTest.java`**

```java
package com.trippyplanner.auth;

import com.trippyplanner.model.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
class AuthControllerTest {

    @Autowired
    MockMvc mvc;

    @MockBean
    UserRepository userRepository;

    @MockBean
    SessionRepository sessionRepository;

    @MockBean
    com.trippyplanner.common.TokenGenerator tokenGenerator;

    @MockBean
    ResendEmailService emailService;

    // SecurityFilter is excluded in @WebMvcTest; simulate authenticated requests
    // by setting request attributes directly via RequestPostProcessor.

    @Test
    void requestMagicLinkReturns204() throws Exception {
        when(userRepository.findOrCreate("user@example.com")).thenReturn(1L);
        when(tokenGenerator.generate()).thenReturn("generatedtoken12345");

        mvc.perform(post("/magic-link")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"user@example.com\"}"))
            .andExpect(status().isNoContent());

        verify(emailService).sendMagicLink("user@example.com", "generatedtoken12345");
    }

    @Test
    void getMeReturnsCurrentUser() throws Exception {
        when(userRepository.findEmailById(42L)).thenReturn(Optional.of("me@example.com"));

        mvc.perform(get("/me")
                .requestAttr("userId", 42L))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(42))
            .andExpect(jsonPath("$.email").value("me@example.com"));
    }

    @Test
    void deleteSessionReturns204() throws Exception {
        mvc.perform(delete("/session")
                .requestAttr("sessionToken", "mytoken"))
            .andExpect(status().isNoContent());

        verify(sessionRepository).delete("mytoken");
    }
}
```

Note: `@WebMvcTest` does not load `SecurityFilter`, so tests use `.requestAttr()` to simulate what the filter would have set. The URL paths in `MockMvc` match the controller mappings (without the `/api` context-path prefix, which is applied at runtime but not in `@WebMvcTest`).

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && ./mvnw test -Dtest=AuthControllerTest
```

Expected: FAIL — `AuthController` not found.

- [ ] **Step 3: Write `AuthController.java`**

```java
package com.trippyplanner.auth;

import com.trippyplanner.api.AuthApi;
import com.trippyplanner.common.TokenGenerator;
import com.trippyplanner.model.MagicLinkRequest;
import com.trippyplanner.model.User;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController implements AuthApi {

    private final UserRepository userRepository;
    private final SessionRepository sessionRepository;
    private final TokenGenerator tokenGenerator;
    private final ResendEmailService emailService;
    private final HttpServletRequest request;
    private final long sessionExpiryMinutes;

    public AuthController(
            UserRepository userRepository,
            SessionRepository sessionRepository,
            TokenGenerator tokenGenerator,
            ResendEmailService emailService,
            HttpServletRequest request,
            @Value("${app.session-expiry-minutes:43200}") long sessionExpiryMinutes) {
        this.userRepository = userRepository;
        this.sessionRepository = sessionRepository;
        this.tokenGenerator = tokenGenerator;
        this.emailService = emailService;
        this.request = request;
        this.sessionExpiryMinutes = sessionExpiryMinutes;
    }

    @Override
    public ResponseEntity<Void> requestMagicLink(MagicLinkRequest body) {
        long userId = userRepository.findOrCreate(body.getEmail());
        String token = tokenGenerator.generate();
        sessionRepository.save(token, userId, sessionExpiryMinutes);
        emailService.sendMagicLink(body.getEmail(), token);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<User> getMe() {
        long userId = (Long) request.getAttribute("userId");
        String email = userRepository.findEmailById(userId).orElseThrow();
        User user = new User();
        user.setId(userId);
        user.setEmail(email);
        return ResponseEntity.ok(user);
    }

    @Override
    public ResponseEntity<Void> deleteSession() {
        String token = (String) request.getAttribute("sessionToken");
        sessionRepository.delete(token);
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && ./mvnw test -Dtest=AuthControllerTest
```

Expected: `BUILD SUCCESS`, 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/trippyplanner/auth/AuthController.java \
        backend/src/test/java/com/trippyplanner/auth/AuthControllerTest.java
git commit -m "feat: add AuthController implementing magic-link, me, and session endpoints"
```

---

### Task 8: RouteRepository

**Files:**
- Create: `backend/src/main/java/com/trippyplanner/routes/RouteRepository.java`
- Create: `backend/src/test/java/com/trippyplanner/routes/RouteRepositoryTest.java`

- [ ] **Step 1: Write `RouteRepositoryTest.java`**

```java
package com.trippyplanner.routes;

import com.trippyplanner.auth.UserRepository;
import com.trippyplanner.model.CreateRouteRequest;
import com.trippyplanner.model.RouteListItem;
import com.trippyplanner.model.UpdateRouteRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.JdbcTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@JdbcTest
@Testcontainers
@Import({RouteRepository.class, UserRepository.class})
class RouteRepositoryTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17");

    @Autowired RouteRepository routeRepo;
    @Autowired UserRepository userRepo;

    long userId;

    @BeforeEach
    void setup() {
        userId = userRepo.findOrCreate("route-test@example.com");
    }

    private CreateRouteRequest sampleRequest() {
        var req = new CreateRouteRequest();
        req.setName("Test Route");
        req.setGpxContent("<gpx/>");
        req.setAvgSpeedKmh(20.0);
        req.setStartTime(OffsetDateTime.now());
        return req;
    }

    @Test
    void savesAndRetrievesRoute() {
        var saved = routeRepo.save(userId, sampleRequest());
        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getName()).isEqualTo("Test Route");
        assertThat(saved.getGpxContent()).isEqualTo("<gpx/>");
    }

    @Test
    void listsByUserId() {
        routeRepo.save(userId, sampleRequest());
        routeRepo.save(userId, sampleRequest());
        List<RouteListItem> list = routeRepo.findAllByUserId(userId);
        assertThat(list).hasSize(2);
        assertThat(list.get(0).getGpxContent()).isNull(); // list view excludes GPX
    }

    @Test
    void updatesNameOnly() {
        var saved = routeRepo.save(userId, sampleRequest());
        var update = new UpdateRouteRequest();
        update.setName("Updated Name");
        var updated = routeRepo.update(saved.getId(), update).orElseThrow();
        assertThat(updated.getName()).isEqualTo("Updated Name");
        assertThat(updated.getAvgSpeedKmh()).isEqualTo(20.0);
    }

    @Test
    void deletesRoute() {
        var saved = routeRepo.save(userId, sampleRequest());
        routeRepo.delete(saved.getId());
        assertThat(routeRepo.findById(saved.getId())).isEmpty();
    }

    @Test
    void sharesAndUnsharesRoute() {
        var saved = routeRepo.save(userId, sampleRequest());
        String token = routeRepo.share(saved.getId(), "sharetoken123");
        assertThat(routeRepo.findByShareToken(token)).isPresent();

        routeRepo.unshare(saved.getId());
        assertThat(routeRepo.findByShareToken(token)).isEmpty();
    }

    @Test
    void shareIsIdempotent() {
        var saved = routeRepo.save(userId, sampleRequest());
        routeRepo.share(saved.getId(), "token-first");
        assertThat(routeRepo.findShareToken(saved.getId())).contains("token-first");
    }

    @Test
    void findOwnerUserId() {
        var saved = routeRepo.save(userId, sampleRequest());
        assertThat(routeRepo.findOwnerUserId(saved.getId())).contains(userId);
        assertThat(routeRepo.findOwnerUserId(UUID.randomUUID())).isEmpty();
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && ./mvnw test -Dtest=RouteRepositoryTest
```

Expected: FAIL — `RouteRepository` not found.

- [ ] **Step 3: Write `RouteRepository.java`**

```java
package com.trippyplanner.routes;

import com.trippyplanner.model.CreateRouteRequest;
import com.trippyplanner.model.Route;
import com.trippyplanner.model.RouteListItem;
import com.trippyplanner.model.UpdateRouteRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.*;

@Repository
public class RouteRepository {
    private final JdbcTemplate jdbc;

    public RouteRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<Route> FULL_MAPPER = (rs, rowNum) -> {
        Route r = new Route();
        r.setId(rs.getObject("id", UUID.class));
        r.setName(rs.getString("name"));
        r.setAvgSpeedKmh(rs.getDouble("avg_speed_kmh"));
        r.setStartTime(rs.getObject("start_time", OffsetDateTime.class));
        r.setIsPublic(rs.getBoolean("is_public"));
        r.setCreatedAt(rs.getObject("created_at", OffsetDateTime.class));
        r.setGpxContent(rs.getString("gpx_content"));
        return r;
    };

    private static final RowMapper<RouteListItem> LIST_MAPPER = (rs, rowNum) -> {
        RouteListItem r = new RouteListItem();
        r.setId(rs.getObject("id", UUID.class));
        r.setName(rs.getString("name"));
        r.setAvgSpeedKmh(rs.getDouble("avg_speed_kmh"));
        r.setStartTime(rs.getObject("start_time", OffsetDateTime.class));
        r.setIsPublic(rs.getBoolean("is_public"));
        r.setCreatedAt(rs.getObject("created_at", OffsetDateTime.class));
        return r;
    };

    public List<RouteListItem> findAllByUserId(long userId) {
        return jdbc.query(
            "SELECT id, name, avg_speed_kmh, start_time, is_public, created_at " +
            "FROM routes WHERE user_id = ? ORDER BY created_at DESC",
            LIST_MAPPER, userId);
    }

    public Optional<Route> findById(UUID id) {
        return jdbc.query(
            "SELECT id, name, avg_speed_kmh, start_time, is_public, created_at, gpx_content " +
            "FROM routes WHERE id = ?",
            FULL_MAPPER, id).stream().findFirst();
    }

    public Optional<Long> findOwnerUserId(UUID id) {
        return jdbc.queryForList(
            "SELECT user_id FROM routes WHERE id = ?", Long.class, id).stream().findFirst();
    }

    public Route save(long userId, CreateRouteRequest req) {
        UUID id = UUID.randomUUID();
        jdbc.update(
            "INSERT INTO routes (id, user_id, name, gpx_content, avg_speed_kmh, start_time) " +
            "VALUES (?, ?, ?, ?, ?, ?)",
            id, userId, req.getName(), req.getGpxContent(),
            req.getAvgSpeedKmh(), req.getStartTime());
        return findById(id).orElseThrow();
    }

    public Optional<Route> update(UUID id, UpdateRouteRequest req) {
        List<String> sets = new ArrayList<>();
        List<Object> params = new ArrayList<>();
        if (req.getName() != null) { sets.add("name = ?"); params.add(req.getName()); }
        if (req.getAvgSpeedKmh() != null) { sets.add("avg_speed_kmh = ?"); params.add(req.getAvgSpeedKmh()); }
        if (req.getStartTime() != null) { sets.add("start_time = ?"); params.add(req.getStartTime()); }
        if (sets.isEmpty()) return findById(id);
        sets.add("updated_at = now()");
        params.add(id);
        jdbc.update("UPDATE routes SET " + String.join(", ", sets) + " WHERE id = ?", params.toArray());
        return findById(id);
    }

    public void delete(UUID id) {
        jdbc.update("DELETE FROM routes WHERE id = ?", id);
    }

    public String share(UUID id, String token) {
        jdbc.update(
            "UPDATE routes SET is_public = true, share_token = ?, updated_at = now() WHERE id = ?",
            token, id);
        return token;
    }

    public void unshare(UUID id) {
        jdbc.update(
            "UPDATE routes SET is_public = false, share_token = NULL, updated_at = now() WHERE id = ?",
            id);
    }

    public Optional<Route> findByShareToken(String token) {
        return jdbc.query(
            "SELECT id, name, avg_speed_kmh, start_time, is_public, created_at, gpx_content " +
            "FROM routes WHERE share_token = ? AND is_public = true",
            FULL_MAPPER, token).stream().findFirst();
    }

    public Optional<String> findShareToken(UUID id) {
        return jdbc.queryForList(
            "SELECT share_token FROM routes WHERE id = ? AND share_token IS NOT NULL AND is_public = true",
            String.class, id).stream().findFirst();
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && ./mvnw test -Dtest=RouteRepositoryTest
```

Expected: `BUILD SUCCESS`, 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/trippyplanner/routes/RouteRepository.java \
        backend/src/test/java/com/trippyplanner/routes/RouteRepositoryTest.java
git commit -m "feat: add RouteRepository with CRUD and share/unshare operations"
```

---

### Task 9: RoutesController

**Files:**
- Create: `backend/src/main/java/com/trippyplanner/routes/RoutesController.java`
- Create: `backend/src/test/java/com/trippyplanner/routes/RoutesControllerTest.java`

- [ ] **Step 1: Write `RoutesControllerTest.java`**

```java
package com.trippyplanner.routes;

import com.trippyplanner.common.TokenGenerator;
import com.trippyplanner.model.Route;
import com.trippyplanner.model.RouteListItem;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
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
class RoutesControllerTest {

    @Autowired MockMvc mvc;
    @MockBean RouteRepository routeRepository;
    @MockBean TokenGenerator tokenGenerator;

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
        when(routeRepository.findAllByUserId(1L)).thenReturn(List.of(new RouteListItem()));

        mvc.perform(get("/routes").requestAttr("userId", 1L))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());
    }

    @Test
    void getRouteReturns200WhenOwner() throws Exception {
        UUID id = UUID.randomUUID();
        when(routeRepository.findById(id)).thenReturn(Optional.of(sampleRoute(id)));
        when(routeRepository.findOwnerUserId(id)).thenReturn(Optional.of(1L));

        mvc.perform(get("/routes/{id}", id).requestAttr("userId", 1L))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("My Route"));
    }

    @Test
    void getRouteReturns403WhenNotOwner() throws Exception {
        UUID id = UUID.randomUUID();
        when(routeRepository.findById(id)).thenReturn(Optional.of(sampleRoute(id)));
        when(routeRepository.findOwnerUserId(id)).thenReturn(Optional.of(99L));

        mvc.perform(get("/routes/{id}", id).requestAttr("userId", 1L))
            .andExpect(status().isForbidden());
    }

    @Test
    void createRouteReturns201() throws Exception {
        UUID id = UUID.randomUUID();
        when(routeRepository.save(eq(1L), any())).thenReturn(sampleRoute(id));

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
        when(routeRepository.findOwnerUserId(id)).thenReturn(Optional.of(1L));

        mvc.perform(delete("/routes/{id}", id).requestAttr("userId", 1L))
            .andExpect(status().isNoContent());
        verify(routeRepository).delete(id);
    }

    @Test
    void shareRouteReturnsToken() throws Exception {
        UUID id = UUID.randomUUID();
        when(routeRepository.findOwnerUserId(id)).thenReturn(Optional.of(1L));
        when(routeRepository.findShareToken(id)).thenReturn(Optional.empty());
        when(tokenGenerator.generate()).thenReturn("sharetoken12345678");
        when(routeRepository.share(id, "sharetoken12345678")).thenReturn("sharetoken12345678");

        mvc.perform(post("/routes/{id}/share", id).requestAttr("userId", 1L))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.shareToken").value("sharetoken12345678"));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && ./mvnw test -Dtest=RoutesControllerTest
```

Expected: FAIL — `RoutesController` not found.

- [ ] **Step 3: Write `RoutesController.java`**

```java
package com.trippyplanner.routes;

import com.trippyplanner.api.RoutesApi;
import com.trippyplanner.common.TokenGenerator;
import com.trippyplanner.model.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
public class RoutesController implements RoutesApi {

    private final RouteRepository routeRepository;
    private final TokenGenerator tokenGenerator;
    private final HttpServletRequest request;

    public RoutesController(RouteRepository routeRepository, TokenGenerator tokenGenerator,
            HttpServletRequest request) {
        this.routeRepository = routeRepository;
        this.tokenGenerator = tokenGenerator;
        this.request = request;
    }

    @Override
    public ResponseEntity<List<RouteListItem>> listRoutes() {
        return ResponseEntity.ok(routeRepository.findAllByUserId(currentUserId()));
    }

    @Override
    public ResponseEntity<Route> createRoute(CreateRouteRequest body) {
        Route route = routeRepository.save(currentUserId(), body);
        return ResponseEntity.status(HttpStatus.CREATED).body(route);
    }

    @Override
    public ResponseEntity<Route> getRoute(UUID id) {
        Route route = routeRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        assertOwnership(id, currentUserId());
        return ResponseEntity.ok(route);
    }

    @Override
    public ResponseEntity<Route> updateRoute(UUID id, UpdateRouteRequest body) {
        assertOwnership(id, currentUserId());
        Route updated = routeRepository.update(id, body)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return ResponseEntity.ok(updated);
    }

    @Override
    public ResponseEntity<Void> deleteRoute(UUID id) {
        assertOwnership(id, currentUserId());
        routeRepository.delete(id);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<ShareResponse> shareRoute(UUID id) {
        assertOwnership(id, currentUserId());
        String token = routeRepository.findShareToken(id)
            .orElseGet(() -> routeRepository.share(id, tokenGenerator.generate()));
        ShareResponse response = new ShareResponse();
        response.setShareToken(token);
        return ResponseEntity.ok(response);
    }

    @Override
    public ResponseEntity<Void> unshareRoute(UUID id) {
        assertOwnership(id, currentUserId());
        routeRepository.unshare(id);
        return ResponseEntity.noContent().build();
    }

    private long currentUserId() {
        return (Long) request.getAttribute("userId");
    }

    private void assertOwnership(UUID routeId, long userId) {
        Long ownerId = routeRepository.findOwnerUserId(routeId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!ownerId.equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && ./mvnw test -Dtest=RoutesControllerTest
```

Expected: `BUILD SUCCESS`, 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/trippyplanner/routes/ \
        backend/src/test/java/com/trippyplanner/routes/RoutesControllerTest.java
git commit -m "feat: add RoutesController with CRUD and share/unshare endpoints"
```

---

### Task 10: ShareController

**Files:**
- Create: `backend/src/main/java/com/trippyplanner/share/ShareController.java`
- Create: `backend/src/test/java/com/trippyplanner/share/ShareControllerTest.java`

- [ ] **Step 1: Write `ShareControllerTest.java`**

```java
package com.trippyplanner.share;

import com.trippyplanner.model.Route;
import com.trippyplanner.routes.RouteRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ShareController.class)
class ShareControllerTest {

    @Autowired MockMvc mvc;
    @MockBean RouteRepository routeRepository;

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

        when(routeRepository.findByShareToken("validtoken")).thenReturn(Optional.of(r));

        mvc.perform(get("/share/validtoken"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Shared Route"))
            .andExpect(jsonPath("$.gpxContent").value("<gpx/>"));
    }

    @Test
    void returns404ForUnknownToken() throws Exception {
        when(routeRepository.findByShareToken("notoken")).thenReturn(Optional.empty());

        mvc.perform(get("/share/notoken"))
            .andExpect(status().isNotFound());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && ./mvnw test -Dtest=ShareControllerTest
```

Expected: FAIL — `ShareController` not found.

- [ ] **Step 3: Write `ShareController.java`**

```java
package com.trippyplanner.share;

import com.trippyplanner.api.ShareApi;
import com.trippyplanner.model.Route;
import com.trippyplanner.routes.RouteRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class ShareController implements ShareApi {

    private final RouteRepository routeRepository;

    public ShareController(RouteRepository routeRepository) {
        this.routeRepository = routeRepository;
    }

    @Override
    public ResponseEntity<Route> getSharedRoute(String shareToken) {
        return routeRepository.findByShareToken(shareToken)
            .map(ResponseEntity::ok)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && ./mvnw test -Dtest=ShareControllerTest
```

Expected: `BUILD SUCCESS`, 2 tests pass.

- [ ] **Step 5: Run the full test suite**

```bash
cd backend && ./mvnw test
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/trippyplanner/share/ \
        backend/src/test/java/com/trippyplanner/share/
git commit -m "feat: add ShareController for public route access"
```

---

### Task 11: Smoke test end-to-end with docker-compose

- [ ] **Step 1: Start the full stack**

```bash
cp .env.example .env
# Edit .env: add a real RESEND_API_KEY or leave the placeholder for now
make dev
```

- [ ] **Step 2: Verify the backend starts and migrations run**

```bash
curl -s http://localhost:8080/api/auth/me
```

Expected: `401 Unauthorized` (filter is active, no token provided — correct behaviour).

- [ ] **Step 3: Request a magic link**

```bash
curl -s -X POST http://localhost:8080/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

Expected: HTTP 204 (empty body). If `RESEND_API_KEY` is real, an email arrives.

- [ ] **Step 4: Verify routes endpoint requires auth**

```bash
curl -s http://localhost:8080/api/routes
```

Expected: `401 Unauthorized`.

- [ ] **Step 5: Commit**

No code changes in this task — commit only if you made any config fixes during smoke testing.
