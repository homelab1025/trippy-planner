package com.trippyplanner.adapter.web;

import com.trippyplanner.api.ShareApi;
import com.trippyplanner.application.RouteService;
import com.trippyplanner.model.Route;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class ShareController implements ShareApi {

    private final RouteService routeService;

    public ShareController(RouteService routeService) {
        this.routeService = routeService;
    }

    @Override
    public ResponseEntity<Route> getSharedRoute(String shareToken) {
        var route = routeService.findByShareToken(shareToken);
        var gpxContent = routeService.findSharedGpx(shareToken);
        if (route.isEmpty() || gpxContent.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        return ResponseEntity.ok(RouteDtoMapper.toDto(route.get(), gpxContent.get()));
    }
}
