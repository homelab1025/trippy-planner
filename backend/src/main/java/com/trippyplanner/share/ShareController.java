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
