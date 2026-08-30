package com.fitcoach.config;

import com.fitcoach.chat.ChatMessage;
import com.fitcoach.chat.ChatMessageRepository;
import com.fitcoach.coach.CoachProfile;
import com.fitcoach.coach.CoachProfileRepository;
import com.fitcoach.coach.CoachStatus;
import com.fitcoach.coach.CoachingPackage;
import com.fitcoach.coach.CoachingPackageRepository;
import com.fitcoach.diet.DietContent;
import com.fitcoach.diet.DietItem;
import com.fitcoach.diet.DietMeal;
import com.fitcoach.diet.DietPlan;
import com.fitcoach.diet.DietPlanRepository;
import com.fitcoach.payment.Payment;
import com.fitcoach.payment.PaymentRepository;
import com.fitcoach.payment.PaymentStatus;
import com.fitcoach.plan.PlanKind;
import com.fitcoach.plan.PlanTemplate;
import com.fitcoach.plan.PlanTemplateRepository;
import com.fitcoach.subscription.Subscription;
import com.fitcoach.subscription.SubscriptionRepository;
import com.fitcoach.subscription.SubscriptionStatus;
import com.fitcoach.tracking.ProgressEntry;
import com.fitcoach.tracking.ProgressEntryRepository;
import com.fitcoach.user.User;
import com.fitcoach.user.UserRepository;
import com.fitcoach.user.UserRole;
import com.fitcoach.workout.WorkoutDay;
import com.fitcoach.workout.WorkoutExercise;
import com.fitcoach.workout.WorkoutPlan;
import com.fitcoach.workout.WorkoutPlanRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Demo data for local development — the replacement for what used to be a
 * TypeScript mock database compiled into the mobile app.
 *
 *   - 'dev' profile only; a production context never constructs this bean.
 *   - No credentials are baked in: the password comes from DEV_SEED_PASSWORD
 *     and, when it is blank, nothing is seeded at all.
 *   - Idempotent: it stops as soon as it finds the demo users already present.
 */
@Component
@Profile("dev")
public class DevSeedRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DevSeedRunner.class);

    private final UserRepository users;
    private final CoachProfileRepository coachProfiles;
    private final CoachingPackageRepository packages;
    private final PaymentRepository payments;
    private final SubscriptionRepository subscriptions;
    private final WorkoutPlanRepository workoutPlans;
    private final DietPlanRepository dietPlans;
    private final ProgressEntryRepository progress;
    private final ChatMessageRepository chatMessages;
    private final PlanTemplateRepository templates;
    private final PasswordEncoder encoder;
    private final String password;

    public DevSeedRunner(UserRepository users, CoachProfileRepository coachProfiles,
                         CoachingPackageRepository packages, PaymentRepository payments,
                         SubscriptionRepository subscriptions, WorkoutPlanRepository workoutPlans,
                         DietPlanRepository dietPlans, ProgressEntryRepository progress,
                         ChatMessageRepository chatMessages, PlanTemplateRepository templates,
                         PasswordEncoder encoder,
                         @Value("${fitcoach.dev-seed.password:}") String password) {
        this.users = users;
        this.coachProfiles = coachProfiles;
        this.packages = packages;
        this.payments = payments;
        this.subscriptions = subscriptions;
        this.workoutPlans = workoutPlans;
        this.dietPlans = dietPlans;
        this.progress = progress;
        this.chatMessages = chatMessages;
        this.templates = templates;
        this.encoder = encoder;
        this.password = password;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (password == null || password.isBlank()) {
            log.warn("dev seed skipped: set DEV_SEED_PASSWORD to create demo accounts");
            return;
        }
        if (users.findByEmail("coach@fitcoach.app").isPresent()) {
            log.info("dev seed skipped: demo accounts already exist");
            return;
        }

        User admin = user(UserRole.admin, "FitCoach Support", "admin@fitcoach.app");
        User maya = user(UserRole.coach, "Maya Torres", "coach@fitcoach.app");
        User daniel = user(UserRole.coach, "Daniel Reyes", "daniel@fitcoach.app");
        User priya = user(UserRole.coach, "Priya Nair", "priya@fitcoach.app");
        User alex = user(UserRole.client, "Alex Morgan", "client@fitcoach.app");
        User jordan = user(UserRole.client, "Jordan Lee", "jordan@fitcoach.app");
        User sam = user(UserRole.client, "Sam Carter", "sam@fitcoach.app");

        profile(maya, CoachStatus.approved, 8,
                "Strength & nutrition coach with a physiotherapy background. I build sustainable "
                        + "programs around your real schedule — no crash diets, no 2-hour sessions.",
                List.of("Fat loss", "Strength", "Nutrition"));
        profile(daniel, CoachStatus.approved, 6,
                "Powerlifting coach focused on technique-first strength.",
                List.of("Powerlifting", "Hypertrophy", "Technique"));
        profile(priya, CoachStatus.pending, 4,
                "Mobility and post-rehab conditioning specialist.", List.of("Mobility", "Rehab"));

        CoachingPackage maya12 = pkg(maya, "12-Week Transformation", 14900, 84,
                List.of("Personalised workout plan", "Nutrition plan & weekly adjustments",
                        "Unlimited chat support", "Weekly progress reviews"));
        pkg(maya, "Monthly Coaching", 5900, 30,
                List.of("Personalised workout plan", "Nutrition guidelines", "Chat support (Mon-Fri)"));
        CoachingPackage dan12 = pkg(daniel, "Powerbuilding Block", 12900, 84,
                List.of("Periodised 12-week program", "Diet template & macros", "Weekly check-ins"));

        paid(alex, maya, maya12, 64, 20);       // active: started 64d ago, 20d left
        paid(jordan, maya, maya12, 70, -10);    // expired
        paid(sam, daniel, dan12, 30, 54);       // active

        workoutPlans.save(workoutPlan(maya.getId(), alex.getId(), "Summer Rebuild — Block 2"));
        dietPlans.save(dietPlan(maya.getId(), alex.getId(), "Lean rebuild — 2,400 kcal"));

        double[] weights = {82.4, 81.6, 81.1, 80.5, 80.0, 79.3, 78.8, 78.2};
        for (int i = 0; i < weights.length; i++) {
            progress.save(progressEntry(alex.getId(), maya.getId(),
                    LocalDate.now().minusDays((weights.length - i) * 7L), weights[i]));
        }

        message(maya, alex, "Welcome aboard, Alex! Your plan is live — check the workout and diet tabs.");
        message(alex, maya, "Just went through everything. Day 2 looks brutal.");
        message(maya, alex, "It is. Drop the incline press to 8kg if needed. Form over ego.");

        template(maya, PlanKind.workout, "Foundation Strength (Beginner)",
                "3-day full-body split. Great first plan for new lifters.");

        log.info("dev seed complete — {} users created", users.count());
    }

    // ----------------------------------------------------------- builders ---

    private User user(UserRole role, String name, String email) {
        User u = new User();
        u.setRole(role);
        u.setName(name);
        u.setEmail(email);
        u.setPasswordHash(encoder.encode(password)); // BCrypt, never logged
        return users.save(u);
    }

    private void profile(User coach, CoachStatus status, int years, String bio, List<String> specialties) {
        CoachProfile p = new CoachProfile();
        p.setUserId(coach.getId());
        p.setBio(bio);
        p.setSpecialties(new ArrayList<>(specialties));
        p.setExperienceYears(years);
        p.setStatus(status);
        coachProfiles.save(p);
    }

    private CoachingPackage pkg(User coach, String title, long priceCents, int days, List<String> features) {
        CoachingPackage p = new CoachingPackage();
        p.setCoachId(coach.getId());
        p.setTitle(title);
        p.setPriceCents(priceCents);
        p.setDurationDays(days);
        p.setFeatures(new ArrayList<>(features));
        return packages.save(p);
    }

    /** A captured payment plus the matching subscription, back-dated. */
    private void paid(User client, User coach, CoachingPackage pkg, long startedDaysAgo, long daysLeft) {
        Payment payment = new Payment();
        payment.setClientId(client.getId());
        payment.setCoachId(coach.getId());
        payment.setPackageId(pkg.getId());
        payment.setAmountCents(pkg.getPriceCents());
        payment.setStatus(PaymentStatus.captured);
        payments.save(payment);

        Instant start = Instant.now().minus(startedDaysAgo, ChronoUnit.DAYS);
        Subscription s = new Subscription();
        s.setClientId(client.getId());
        s.setCoachId(coach.getId());
        s.setPackageId(pkg.getId());
        s.setStatus(daysLeft > 0 ? SubscriptionStatus.active : SubscriptionStatus.expired);
        s.setStartDate(start);
        s.setEndDate(Instant.now().plus(daysLeft, ChronoUnit.DAYS));
        s.setPaymentId(payment.getId());
        subscriptions.save(s);
    }

    private WorkoutPlan workoutPlan(UUID coachId, UUID clientId, String title) {
        WorkoutPlan p = new WorkoutPlan();
        p.setCoachId(coachId);
        p.setClientId(clientId);
        p.setTitle(title);
        p.setContent(List.of(
                day("Day 1", "Lower body — strength",
                        ex("Back squat", 4, "6", 150), ex("Romanian deadlift", 3, "8", 120),
                        ex("Walking lunges", 3, "12/leg", 90), ex("Standing calf raise", 4, "15", 60)),
                day("Day 2", "Upper body — push",
                        ex("Bench press", 4, "6-8", 150), ex("Overhead press", 3, "8", 120),
                        ex("Incline DB press", 3, "10", 90), ex("Cable fly", 3, "12", 60)),
                day("Day 3", "Upper body — pull",
                        ex("Weighted pull-up", 4, "6", 150), ex("Barbell row", 4, "8", 120),
                        ex("Face pull", 3, "15", 60), ex("Hammer curl", 3, "12", 60))));
        return p;
    }

    private WorkoutDay day(String name, String focus, WorkoutExercise... exercises) {
        WorkoutDay d = new WorkoutDay();
        d.setName(name);
        d.setFocus(focus);
        d.setExercises(List.of(exercises));
        return d;
    }

    private WorkoutExercise ex(String name, int sets, String reps, int restSec) {
        WorkoutExercise e = new WorkoutExercise();
        e.setName(name);
        e.setSets(sets);
        e.setReps(reps);
        e.setRestSec(restSec);
        return e;
    }

    private DietPlan dietPlan(UUID coachId, UUID clientId, String title) {
        DietPlan p = new DietPlan();
        p.setCoachId(coachId);
        p.setClientId(clientId);
        p.setTitle(title);
        DietContent c = new DietContent();
        c.setTargetKcal(2400);
        c.setNotes("Drink 2.5-3L water daily.");
        c.setMeals(List.of(
                meal("Breakfast", "7:30", item("Oats with berries", "80g", 380, 13, 68, 6),
                        item("Whole eggs", "3", 230, 19, 1, 15)),
                meal("Lunch", "12:30", item("Chicken breast", "180g", 300, 46, 0, 8),
                        item("Jasmine rice", "200g cooked", 260, 5, 57, 1)),
                meal("Dinner", "19:30", item("Baked salmon", "150g", 310, 32, 0, 19),
                        item("Baby potatoes", "250g", 210, 5, 43, 0))));
        p.setContent(c);
        return p;
    }

    private DietMeal meal(String name, String time, DietItem... items) {
        DietMeal m = new DietMeal();
        m.setName(name);
        m.setTime(time);
        m.setItems(List.of(items));
        return m;
    }

    private DietItem item(String food, String qty, int kcal, double protein, double carbs, double fat) {
        DietItem i = new DietItem();
        i.setFood(food);
        i.setQty(qty);
        i.setKcal(kcal);
        i.setProtein(protein);
        i.setCarbs(carbs);
        i.setFat(fat);
        return i;
    }

    private ProgressEntry progressEntry(UUID clientId, UUID coachId, LocalDate date, double weightKg) {
        ProgressEntry e = new ProgressEntry();
        e.setClientId(clientId);
        e.setCoachId(coachId);
        e.setEntryDate(date);
        e.setWeightKg(BigDecimal.valueOf(weightKg));
        e.setMeasurements(Map.of("waist", 92.0 - (56 - date.until(LocalDate.now(), ChronoUnit.DAYS)) * 0.1));
        e.setNotes("");
        return e;
    }

    private void message(User sender, User other, String body) {
        ChatMessage m = new ChatMessage();
        boolean senderIsCoach = sender.getRole() == UserRole.coach;
        m.setCoachId(senderIsCoach ? sender.getId() : other.getId());
        m.setClientId(senderIsCoach ? other.getId() : sender.getId());
        m.setSenderId(sender.getId());
        m.setBody(body);
        chatMessages.save(m);
    }

    private void template(User coach, PlanKind kind, String title, String note) {
        PlanTemplate t = new PlanTemplate();
        t.setCoachId(coach.getId());
        t.setKind(kind);
        t.setTitle(title);
        t.setNote(note);
        t.setDays(List.of(day("Day 1", "Full body — squat pattern",
                ex("Goblet squat", 3, "10", 90), ex("Push-up", 3, "8-12", 75),
                ex("Seated cable row", 3, "12", 60))));
        templates.save(t);
    }
}
