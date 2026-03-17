import type { AccordionSection } from '../components/accordion';

export const performanceGuide: AccordionSection[] = [
  {
    title: '1. Loop Overruns — The #1 Issue',
    content: `
      <h5>What Are Loop Overruns?</h5>
      <p>The robot's main loop runs at 50Hz (every 20ms). If your code takes longer than 20ms, you get a "loop overrun" — the robot becomes unresponsive, jerky, and may trigger watchdog warnings.</p>

      <h5>Fix #1: Disable LiveWindow Telemetry</h5>
      <p>This is the single most common fix for loop overruns. LiveWindow sends massive amounts of telemetry data even when you're not using Test Mode. Add this one line to your robotInit():</p>
      <pre>@Override
public void robotInit() {
    // ADD THIS LINE FIRST - fixes most loop overrun issues
    LiveWindow.disableAllTelemetry();

    // ... rest of your initialization
}</pre>

      <h5>Fix #2: Remove System.out.println()</h5>
      <p>Console output is surprisingly slow and can cause major delays when called every loop:</p>
      <pre>// BAD - Don't do this in periodic methods!
public void teleopPeriodic() {
    System.out.println("Speed: " + motor.getVelocity());
}

// GOOD - Use SmartDashboard (with throttling) or remove entirely
SmartDashboard.putNumber("Speed", motor.getVelocity());</pre>

      <h5>Fix #3: Move PhotonVision.verifyVersion() Off Main Thread</h5>
      <p>This call blocks while waiting for a network response and can stall your robot for seconds:</p>
      <pre>// BAD - Blocks the main thread
PhotonCamera camera = new PhotonCamera("cam");
camera.verifyVersion(); // Can block for 2+ seconds!

// GOOD - Run in a background thread or skip entirely
new Thread(() -> {
    try {
        camera.verifyVersion();
    } catch (Exception e) {
        // Log but don't crash
    }
}).start();</pre>
    `,
  },
  {
    title: '2. Watchdog Triggers & Timing',
    content: `
      <h5>What Causes Watchdog Triggers?</h5>
      <p>The watchdog monitors your main loop timing. When your code takes too long, you'll see watchdog warnings in the Driver Station. Common causes:</p>
      <ul>
        <li><strong>Blocking network calls</strong> — HTTP requests, vision processing, NetworkTables waiting</li>
        <li><strong>File I/O</strong> — Reading/writing files on the roboRIO</li>
        <li><strong>Heavy computation</strong> — Complex path calculations, excessive logging</li>
        <li><strong>CAN bus congestion</strong> — Too many motor commands flooding the bus</li>
      </ul>

      <h5>Diagnosing Watchdog Issues</h5>
      <p>Check your .dslog file for patterns. If you see repeated watchdog triggers:</p>
      <ol>
        <li>First, add <code>LiveWindow.disableAllTelemetry()</code> — this fixes most cases</li>
        <li>Check for any blocking calls in periodic methods</li>
        <li>Profile your code using WPILib's Tracer class</li>
      </ol>

      <h5>Using the Tracer for Profiling</h5>
      <pre>import edu.wpi.first.wpilibj.Tracer;

private final Tracer tracer = new Tracer();

public void robotPeriodic() {
    tracer.clearEpochs();

    subsystem1.periodic();
    tracer.addEpoch("Subsystem1");

    subsystem2.periodic();
    tracer.addEpoch("Subsystem2");

    tracer.printEpochs(); // Shows timing in console
}</pre>
    `,
  },
  {
    title: '3. Brownouts & Power Issues',
    content: `
      <h5>What Causes Brownouts?</h5>
      <p>Brownouts occur when battery voltage drops below safe levels (typically &lt;6.8V). The roboRIO will disable motors to protect itself. Common causes:</p>
      <ul>
        <li><strong>Weak battery</strong> — Old batteries or poor connections</li>
        <li><strong>High current draw</strong> — Too many motors at full power simultaneously</li>
        <li><strong>Bad wiring</strong> — Loose connections, undersized wire gauge</li>
        <li><strong>Stalled motors</strong> — Mechanisms that can't move but are still powered</li>
      </ul>

      <h5>Preventing Brownouts</h5>
      <pre>// Set current limits on your motors
sparkMax.setSmartCurrentLimit(40); // Amps - adjust per motor

// For NEOs: 40A is a good starting point
// For NEO 550s: 20-25A is typically safe

// Use voltage compensation for consistent behavior
sparkMax.enableVoltageCompensation(12.0);</pre>

      <h5>Battery Checklist</h5>
      <ul>
        <li>Check battery voltage with a multimeter (should be 12.5V+ when charged)</li>
        <li>Inspect Anderson connector for corrosion or loose fit</li>
        <li>Test battery internal resistance if possible (&lt;0.015 ohms is good)</li>
        <li>Use battery beak or similar tool for quick health checks</li>
        <li>Rotate batteries during competition — don't run one battery all day</li>
      </ul>
    `,
  },
  {
    title: '4. CAN Bus Optimization',
    content: `
      <h5>CAN Bus Bandwidth Limits</h5>
      <p>The CAN bus has limited bandwidth (~1 Mbps). With 8+ motors plus sensors, you can easily saturate it. Symptoms: delayed motor response, jerky motion, communication errors.</p>

      <h5>SparkMax Frame Period Tuning</h5>
      <p>By default, SparkMax controllers send lots of status data. Slow down frames you don't need:</p>
      <pre>// Reduce frame rates for unused data
sparkMax.setPeriodicFramePeriod(PeriodicFrame.kStatus0, 100); // Faults (default 10ms)
sparkMax.setPeriodicFramePeriod(PeriodicFrame.kStatus1, 500); // Velocity/temp (default 20ms)
sparkMax.setPeriodicFramePeriod(PeriodicFrame.kStatus2, 500); // Position (default 20ms)
sparkMax.setPeriodicFramePeriod(PeriodicFrame.kStatus3, 500); // Analog sensor (default 50ms)
sparkMax.setPeriodicFramePeriod(PeriodicFrame.kStatus4, 500); // Alt encoder (default 20ms)

// Keep fast rates only for what you actually read!
// If using velocity PID: keep Status1 at 20ms
// If using position PID: keep Status2 at 20ms</pre>

      <h5>Never Configure Motors in Periodic Methods</h5>
      <pre>// BAD - This runs 50 times per second, flooding CAN bus!
public void teleopPeriodic() {
    motor.setSmartCurrentLimit(40);
    motor.setIdleMode(IdleMode.kBrake);
}

// GOOD - Configure once in constructor or robotInit
public DriveSubsystem() {
    motor.restoreFactoryDefaults();
    motor.setSmartCurrentLimit(40);
    motor.setIdleMode(IdleMode.kBrake);
    motor.burnFlash(); // Persist settings
}</pre>
    `,
  },
  {
    title: '5. Swerve Drive Performance',
    content: `
      <h5>CAN Device Count</h5>
      <p>Swerve drives are CAN-heavy: 8 motors + 4 encoders = 12 devices minimum. Add arm, intake, shooter and you can hit 20+ devices. YAGSL recommends keeping total CAN IDs under 40.</p>

      <h5>Optimize Module States</h5>
      <p>Always optimize swerve module states to prevent 180° wheel flips:</p>
      <pre>SwerveModuleState optimized = SwerveModuleState.optimize(
    desiredState,
    currentRotation
);
// Use optimized state for motor commands</pre>

      <h5>Odometry Thread Safety</h5>
      <p>Many swerve libraries (YAGSL, Phoenix 6) run odometry in separate threads. Avoid race conditions:</p>
      <pre>// Use thread-safe reads
private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();

public Pose2d getPose() {
    lock.readLock().lock();
    try {
        return currentPose;
    } finally {
        lock.readLock().unlock();
    }
}</pre>

      <h5>Swerve-Specific Frame Periods</h5>
      <p>For swerve drive motors, you typically need:</p>
      <ul>
        <li><strong>Drive motors:</strong> Status1 (velocity) at 20ms for velocity control</li>
        <li><strong>Steer motors:</strong> Status2 (position) at 20ms for position control</li>
        <li>Everything else can be slowed to 100-500ms</li>
      </ul>
    `,
  },
  {
    title: '6. Vision Systems',
    content: `
      <h5>PhotonVision Performance</h5>
      <p>Vision processing can be expensive. Key optimizations:</p>
      <ul>
        <li>Run verifyVersion() in a background thread (see Loop Overruns section)</li>
        <li>Don't process every frame — check hasTargets() before heavy computation</li>
        <li>Use pipeline switching to disable processing when not needed</li>
      </ul>

      <h5>Limelight Latency Compensation</h5>
      <p>Always account for camera latency when updating pose estimation:</p>
      <pre>// Get latency from Limelight
double latencyMs = limelightTable.getEntry("tl").getDouble(0)
                 + limelightTable.getEntry("cl").getDouble(0);
double latencySeconds = latencyMs / 1000.0;

// Apply measurement at the correct timestamp
double captureTime = Timer.getFPGATimestamp() - latencySeconds;
poseEstimator.addVisionMeasurement(visionPose, captureTime);</pre>

      <h5>Reduce Vision Processing Load</h5>
      <pre>// Only process when you need vision
public void periodic() {
    if (needsVisionUpdate()) {
        var result = camera.getLatestResult();
        if (result.hasTargets()) {
            // Process targets
        }
    }
}

// Switch pipelines when not actively using vision
public void disableVision() {
    limelightTable.getEntry("pipeline").setNumber(DRIVER_PIPELINE);
}</pre>
    `,
  },
  {
    title: '7. Autonomous & PathPlanner',
    content: `
      <h5>NamedCommands Registration Order</h5>
      <p>Commands must be registered BEFORE loading paths that use them:</p>
      <pre>// In RobotContainer constructor - ORDER MATTERS!

// 1. First, register ALL named commands
NamedCommands.registerCommand("intake", intakeCommand);
NamedCommands.registerCommand("shoot", shootCommand);
NamedCommands.registerCommand("align", alignCommand);

// 2. THEN load paths and build autos
autoChooser = AutoBuilder.buildAutoChooser();</pre>

      <h5>Auto Chooser Setup</h5>
      <p>Build your auto chooser in robotInit/RobotContainer, not autonomousInit:</p>
      <pre>// In RobotContainer or robotInit
autoChooser = new SendableChooser&lt;&gt;();
autoChooser.setDefaultOption("Simple Auto", simpleAuto);
autoChooser.addOption("2 Piece", twoPieceAuto);
autoChooser.addOption("3 Piece", threePieceAuto);
SmartDashboard.putData("Auto Chooser", autoChooser);

// In autonomousInit - just get and run
@Override
public void autonomousInit() {
    Command auto = autoChooser.getSelected();
    if (auto != null) {
        auto.schedule();
    }
}</pre>

      <h5>Path Loading Performance</h5>
      <p>Load paths at startup, not during auto:</p>
      <pre>// GOOD - Load once at startup
private final PathPlannerPath scorePath = PathPlannerPath.fromPathFile("Score");

// BAD - Loading during auto causes delays
public Command getAutoCommand() {
    return PathPlannerPath.fromPathFile("Score"); // Slow!
}</pre>
    `,
  },
  {
    title: '8. Reading Your Log Files',
    content: `
      <h5>What .dslog Files Tell You</h5>
      <p>Driver Station logs contain telemetry recorded at 50Hz:</p>
      <ul>
        <li><strong>Voltage</strong> — Look for drops below 7V (brownout territory)</li>
        <li><strong>CPU %</strong> — Should stay below 80%; spikes indicate loop overruns</li>
        <li><strong>CAN Usage %</strong> — Should stay below 70%; high values mean bus congestion</li>
        <li><strong>Watchdog flags</strong> — Indicates main loop timing violations</li>
        <li><strong>Brownout flags</strong> — Indicates voltage protection triggered</li>
      </ul>

      <h5>Common Patterns</h5>
      <table style="width:100%; margin: 10px 0;">
        <tr><td><strong>Pattern</strong></td><td><strong>Likely Cause</strong></td></tr>
        <tr><td>High CPU + Watchdog</td><td>Loop overruns — try LiveWindow.disableAllTelemetry()</td></tr>
        <tr><td>High CAN + Jerky motion</td><td>CAN bus congestion — reduce frame rates</td></tr>
        <tr><td>Voltage drops + Brownout</td><td>Power issues — check battery/wiring</td></tr>
        <tr><td>Spikes at mode change</td><td>Heavy initialization — move work to background threads</td></tr>
      </table>

      <h5>.dsevents Files</h5>
      <p>Event logs contain timestamped messages — errors, warnings, and info. Look for:</p>
      <ul>
        <li>CAN device disconnection messages</li>
        <li>Motor controller faults</li>
        <li>Exception stack traces</li>
        <li>FMS connection issues</li>
      </ul>
    `,
  },
];
