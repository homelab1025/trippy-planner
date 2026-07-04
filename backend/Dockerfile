FROM eclipse-temurin:25-jdk AS build
WORKDIR /app
COPY openapi.yaml /openapi.yaml
COPY backend/.mvn/ .mvn/
COPY backend/mvnw backend/pom.xml ./
RUN ./mvnw dependency:go-offline -q
COPY backend/src ./src
RUN ./mvnw package -q -DskipTests

FROM eclipse-temurin:25-jre-jammy
WORKDIR /app
COPY --from=build /app/target/backend-1.0.0-SNAPSHOT.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
