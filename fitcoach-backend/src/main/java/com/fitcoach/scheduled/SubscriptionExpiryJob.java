package com.fitcoach.scheduled;

import com.fitcoach.subscription.SubscriptionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Flips ended subscriptions to 'expired'. Read access survives; writes don't. */
@Component
public class SubscriptionExpiryJob {

    private static final Logger log = LoggerFactory.getLogger(SubscriptionExpiryJob.class);

    private final SubscriptionRepository subscriptions;

    public SubscriptionExpiryJob(SubscriptionRepository subscriptions) {
        this.subscriptions = subscriptions;
    }

    @Scheduled(cron = "0 * * * * *") // every minute
    @Transactional
    public void expireEndedSubscriptions() {
        int n = subscriptions.expireEnded(java.time.Instant.now());
        if (n > 0) log.info("expiry job: {} subscription(s) moved to expired", n);
    }
}
