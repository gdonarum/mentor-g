/**
 * Mentor G - Performance Guide Content
 * Copyright (c) 2026 Gregory Donarum
 * Licensed under MIT License with Commons Clause
 */

import type { AccordionSection } from '../components/accordion';

export const performanceGuide: AccordionSection[] = [
  {
    title: '1. Understanding Your Log Files',
    content: `
      <p>FRC robots generate several types of log files that capture different aspects of robot operation. Understanding what each log contains and how to collect them is the first step to effective debugging.</p>

      <h5>📁 .dslog — Driver Station Logs</h5>
      <p>Binary telemetry files recorded by the Driver Station at 50Hz. These are your primary source for robot health metrics.</p>
      <p><strong>What they contain:</strong></p>
      <ul>
        <li><strong>Battery voltage</strong> — Track brownouts, voltage sag, and battery health</li>
        <li><strong>roboRIO CPU usage</strong> — Identify loop overruns and heavy computation</li>
        <li><strong>CAN bus utilization</strong> — Detect bus congestion from too many devices</li>
        <li><strong>Packet loss & trip time</strong> — Network connection quality</li>
        <li><strong>Watchdog & brownout flags</strong> — Critical timing violations</li>
        <li><strong>Robot mode</strong> — Disabled, Auto, Teleop timestamps</li>
      </ul>
      <p><strong>How to collect:</strong></p>
      <ol>
        <li>Open the Driver Station</li>
        <li>Click the <strong>gear icon</strong> (⚙️) → <strong>View Log File</strong></li>
        <li>Or navigate to: <code>C:\\Users\\Public\\Documents\\FRC\\Log Files</code></li>
        <li>Files are named by date/time: <code>2024_03_15 14_30_00.dslog</code></li>
      </ol>

      <h5>📁 .dsevents — Driver Station Events</h5>
      <p>JSON-formatted event logs with timestamped messages from the robot and Driver Station.</p>
      <p><strong>What they contain:</strong></p>
      <ul>
        <li><strong>Console output</strong> — System.out.println() messages from robot code</li>
        <li><strong>Error messages</strong> — Stack traces, exceptions, CAN timeouts</li>
        <li><strong>FMS messages</strong> — Field connection status, match info</li>
        <li><strong>Motor controller faults</strong> — SparkMax/TalonFX errors</li>
        <li><strong>Tracer timing data</strong> — Subsystem performance measurements</li>
        <li><strong>Warnings</strong> — Loop overruns, missing commands, configuration issues</li>
      </ul>
      <p><strong>How to collect:</strong></p>
      <ol>
        <li>Located in the same folder as .dslog files</li>
        <li>Matching timestamp: <code>2024_03_15 14_30_00.dsevents</code></li>
        <li>Upload both files together for best analysis</li>
      </ol>

      <h5>📁 .wpilog — WPILib Data Logs</h5>
      <p>Binary telemetry files recorded by your robot code using WPILib's DataLog system. These contain custom data you choose to log.</p>
      <p><strong>What they contain:</strong></p>
      <ul>
        <li><strong>Motor outputs</strong> — Commanded voltages, velocities, positions</li>
        <li><strong>Sensor readings</strong> — Encoders, gyros, limit switches</li>
        <li><strong>Subsystem state</strong> — Current commands, state machines</li>
        <li><strong>Pose estimation</strong> — Robot position, vision updates</li>
        <li><strong>Custom telemetry</strong> — Anything you log with DataLog API</li>
      </ul>
      <p><strong>How to collect:</strong></p>
      <ol>
        <li>Enable DataLog in your robot code (typically in Robot.java or Constants)</li>
        <li>Files are saved to the roboRIO: <code>/home/lvuser/logs/</code></li>
        <li>Use the roboRIO web dashboard or <code>scp</code> to download</li>
        <li>Or use the WPILib "RoboRIO Data Log Download" tool</li>
      </ol>
      <pre>// Enable DataLog in Robot.java
@Override
public void robotInit() {
    DataLogManager.start();
    // Optionally log specific NetworkTables entries
    DataLogManager.logNetworkTables(false); // Don't log everything!
}</pre>
      <p><strong>Note:</strong> DataLogManager is <strong>not</strong> enabled by default — you must add the code above. This is the opposite of Phoenix 6 SignalLogger, which auto-logs to .hoot files unless you disable it.</p>
      <p><strong>⚠️ Caution:</strong> Avoid <code>logNetworkTables(true)</code> — logging ALL NetworkTables can actually cause loop overruns, especially with PhotonVision or Limelight publishing camera data at high rates. Instead, log specific entries you need using <code>DataLog.getEntry()</code>.</p>

      <h5>💡 Pro Tips</h5>
      <ul>
        <li>Always upload <strong>both .dslog AND .dsevents</strong> — they complement each other</li>
        <li>WPILOG files from Phoenix devices (CTRE) are in <code>.hoot</code> format — convert to .wpilog using <strong>Tuner X Log Extractor</strong> first</li>
        <li>Keep logs from problematic matches — they're invaluable for post-match debugging</li>
        <li>Use descriptive match names in your folder structure for easy retrieval</li>
      </ul>
    `,
  },
  {
    title: '2. Loop Overruns — The #1 Issue',
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

// GOOD - Use a competition mode guard in Constants.java
public class Constants {
    public static final boolean COMPETITION_MODE = true;
}

// Then in your periodic methods:
public void teleopPeriodic() {
    if (!Constants.COMPETITION_MODE) {
        SmartDashboard.putNumber("Speed", motor.getVelocity());
    }
}</pre>
      <p>Set <code>Constants.COMPETITION_MODE = true</code> before matches to disable all debug telemetry. This makes it easy to toggle debugging on/off without deleting code.</p>
    `,
  },
  {
    title: '3. Watchdog Triggers & Timing',
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
    title: '4. Brownouts & Voltage Sag',
    content: `
      <h5>Brownout vs Voltage Sag — Know the Difference!</h5>
      <p><strong>Brownout (&lt;6.3V):</strong> The roboRIO shuts down motors to protect itself. This is serious — check your battery and wiring immediately.</p>
      <p><strong>Voltage sag (7-10V):</strong> Normal under heavy load! When motors draw high current, voltage temporarily drops. This is NOT a brownout — it's just physics. Don't panic if you see 9V during hard acceleration.</p>
      <p><strong>Low voltage (10-11V):</strong> Indicates a weak or partially discharged battery. Not critical, but swap batteries soon.</p>

      <h5>What Causes Actual Brownouts?</h5>
      <p>True brownouts (voltage below 6.3V) are caused by:</p>
      <ul>
        <li><strong>Dead/weak battery</strong> — Old batteries or poor connections</li>
        <li><strong>Stalled motors</strong> — Mechanism jammed but still powered (massive current draw)</li>
        <li><strong>Bad wiring</strong> — Loose connections, undersized wire gauge, corroded terminals</li>
        <li><strong>Shorted wires</strong> — Direct short circuits in the power system</li>
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

      <h5>PDH Current Monitoring</h5>
      <p>The REV Power Distribution Hub (PDH) logs individual channel currents. When you see voltage sag, check PDH data to find which motor is drawing excessive current:</p>
      <pre>// Log PDH currents to find the culprit
PowerDistribution pdh = new PowerDistribution(1, ModuleType.kRev);

// In periodic - check which channel is drawing the most
for (int i = 0; i &lt; 24; i++) {
    double current = pdh.getCurrent(i);
    if (current &gt; 40) { // Suspiciously high
        System.out.println("Channel " + i + ": " + current + "A");
    }
}</pre>
      <p>Knowing whether the Intake (channel 5) or Climber (channel 12) is pulling 60A is the key to fixing your current limits.</p>
    `,
  },
  {
    title: '5. CAN Bus Optimization',
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
      <p><strong>⚠️ burnFlash() Warning:</strong> SparkMax controllers have a limited flash write cycle (~10,000 writes). Only call <code>burnFlash()</code> in initialization code — <strong>never</strong> in a periodic method or loop. Accidentally leaving it in a loop during testing can permanently damage the controller's flash memory.</p>

      <h5>Phoenix 6 SignalLogger (Optional)</h5>
      <p>CTRE Phoenix 6 devices auto-log telemetry to <code>.hoot</code> files on the roboRIO. This is useful for post-match analysis but consumes CAN bandwidth. Disable it during competition if you need every bit of bandwidth:</p>
      <pre>import com.ctre.phoenix6.SignalLogger;

@Override
public void robotInit() {
    // Disable Phoenix 6 auto-logging for competition
    SignalLogger.enableAutoLogging(false);
}</pre>
      <p><strong>Note:</strong> Only disable this if you're NOT having CAN issues. The .hoot logs are valuable for debugging — keep them enabled during practice, then disable for competition if you need the bandwidth.</p>
    `,
  },
  {
    title: '6. Swerve Drive Performance',
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
    title: '7. Vision Systems',
    content: `
      <h5>PhotonVision Performance</h5>
      <p>Vision processing can be expensive. Key optimizations:</p>
      <ul>
        <li>Don't process every frame — check hasTargets() before heavy computation</li>
        <li>Use pipeline switching to disable processing when not needed</li>
        <li>Wrap debug logging in a <code>Constants.COMPETITION_MODE</code> guard</li>
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
      <p>Vision pose estimation doesn't need to run at 50Hz. Use a frame counter to run at 10Hz:</p>
      <pre>private int frameCount = 0;

@Override
public void periodic() {
    // Run vision at 10Hz (every 5th loop) instead of 50Hz
    if (frameCount++ % 5 == 0) {
        updateVisionPose();
    }

    // Other periodic code runs every loop
    updateOdometry();
}

private void updateVisionPose() {
    var result = camera.getLatestResult();
    if (result.hasTargets()) {
        // Process targets and update pose
    }
}</pre>
      <p>This reduces CPU load by 80% while still updating vision 10 times per second — plenty fast for pose estimation.</p>
    `,
  },
  {
    title: '8. Autonomous & PathPlanner',
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
    title: '9. Interpreting Log Patterns',
    content: `
      <h5>Quick Reference: Normal vs Problem Values</h5>
      <table style="width:100%; margin: 10px 0;">
        <tr><td><strong>Metric</strong></td><td><strong>Normal</strong></td><td><strong>Warning</strong></td><td><strong>Critical</strong></td></tr>
        <tr><td>Voltage</td><td>11-13V</td><td>9-11V (sag)</td><td>&lt;6.3V (brownout)</td></tr>
        <tr><td>CPU %</td><td>&lt;50%</td><td>50-80%</td><td>&gt;80%</td></tr>
        <tr><td>CAN Usage</td><td>&lt;50%</td><td>50-70%</td><td>&gt;70%</td></tr>
        <tr><td>Trip Time</td><td>&lt;5ms</td><td>5-15ms</td><td>&gt;15ms</td></tr>
        <tr><td>Packet Loss</td><td>0%</td><td>1-5%</td><td>&gt;5%</td></tr>
      </table>

      <h5>Common Problem Patterns</h5>
      <table style="width:100%; margin: 10px 0;">
        <tr><td><strong>You See...</strong></td><td><strong>This Usually Means...</strong></td><td><strong>First Fix to Try</strong></td></tr>
        <tr><td>High CPU + Watchdog</td><td>Loop overruns</td><td>LiveWindow.disableAllTelemetry()</td></tr>
        <tr><td>High CAN + Jerky motion</td><td>CAN bus congestion</td><td>Increase motor frame periods</td></tr>
        <tr><td>Voltage &lt;6.3V</td><td>True brownout</td><td>Check battery & wiring</td></tr>
        <tr><td>Voltage 7-10V (no brownout flag)</td><td>Normal voltage sag</td><td>Nothing — this is expected!</td></tr>
        <tr><td>CPU spikes at mode change</td><td>Heavy initialization</td><td>Load paths in robotInit()</td></tr>
        <tr><td>CAN timeout errors</td><td>Device disconnected</td><td>Check CAN wiring & IDs</td></tr>
        <tr><td>CommandScheduler overrun</td><td>Slow commands</td><td>Profile with Tracer</td></tr>
      </table>

      <h5>What to Look For in .dsevents</h5>
      <p>Search for these keywords to find issues quickly:</p>
      <ul>
        <li><code>timed out</code> — CAN device communication failures</li>
        <li><code>overrun</code> — Loop timing violations</li>
        <li><code>Exception</code> — Code errors with stack traces</li>
        <li><code>not been registered</code> — Missing PathPlanner NamedCommands</li>
        <li><code>Fault</code> — Motor controller hardware faults</li>
        <li><code>Brownout</code> — Voltage protection triggered</li>
      </ul>

      <h5>WPILOG Analysis Tips</h5>
      <ul>
        <li>Compare motor <strong>commanded</strong> vs <strong>actual</strong> values — large gaps indicate PID tuning issues</li>
        <li>Look for <strong>sudden changes</strong> in sensor readings — may indicate electrical noise or loose connections</li>
        <li>Check <strong>timestamp gaps</strong> — missed logging cycles indicate overruns</li>
        <li>Use AdvantageScope to visualize trends over time</li>
      </ul>
    `,
  },
];
