package com.fitcoach;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class FitCoachApplication {
    public static void main(String[] args) {
        SpringApplication.run(FitCoachApplication.class, args);
    }
}
