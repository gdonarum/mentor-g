import type { AccordionSection } from '../components/accordion';

export const performanceGuide: AccordionSection[] = [
  {
    title: '1. Critical: Loop Overruns & Thread Blocking',
    content: `
      <h5>What Are Loop Overruns?</h5>
      <p>The robot's main loop runs at 50Hz (every 20ms). If your code takes longer than 20ms, you get a "loop overrun" — the robot becomes unresponsive and jerky.</p>

      <h5>Common Culprits</h5>
      <p><strong>System.out.println() in periodic methods:</strong> Console output is surprisingly slow and can cause major delays.</p>
      <pre>// BAD - Don't do this in robotPeriodic!
System.out.println("Speed: " + motor.getVelocity());

// GOOD - Use SmartDashboard or disable in competition
SmartDashboard.putNumber("Speed", motor.getVelocity());</pre>

      <p><strong>PhotonVision verifyVersion():</strong> This call blocks while waiting for a network response.</p>
      <pre>// BAD - Blocks the main thread
PhotonCamera camera = new PhotonCamera("cam");
camera.verifyVersion(); // Can block for seconds!

// GOOD - Run verification in a separate thread or skip in competition
if (!DriverStation.isFMSAttached()) {
    new Thread(() -> camera.verifyVersion()).start();
}</pre>

      <h5>LiveWindow Overhead</h5>
      <p>LiveWindow sends lots of data during test mode. Disable it if you're not using it:</p>
      <pre>// In robotInit()
LiveWindow.disableAllTelemetry();</pre>
    `,
  },
  {
    title: '2. CAN Bus Performance',
    content: `
      <h5>CAN Bus Bandwidth</h5>
      <p>The CAN bus has limited bandwidth. Too many devices or too-frequent updates will cause communication delays.</p>

      <h5>SparkMax Frame Period Tuning</h5>
      <p>By default, SparkMax controllers send lots of data. Reduce frame rates for data you don't need:</p>
      <pre>// Slow down status frames you don't need
sparkMax.setPeriodicFramePeriod(PeriodicFrame.kStatus0, 100); // Default 10ms
sparkMax.setPeriodicFramePeriod(PeriodicFrame.kStatus1, 500); // Default 20ms
sparkMax.setPeriodicFramePeriod(PeriodicFrame.kStatus2, 500); // Default 20ms

// Only keep fast updates for what you actually use
// Status0: Faults, applied output
// Status1: Velocity, temperature, voltage, current
// Status2: Position</pre>

      <h5>Motor Configuration in Periodic Methods</h5>
      <p>Never configure motors inside periodic methods — it floods the CAN bus:</p>
      <pre>// BAD - This runs 50 times per second!
public void teleopPeriodic() {
    motor.setSmartCurrentLimit(40); // CAN message every loop!
}

// GOOD - Configure once in robotInit or subsystem constructor
public void robotInit() {
    motor.setSmartCurrentLimit(40);
    motor.burnFlash(); // Save to flash memory
}</pre>
    `,
  },
  {
    title: '3. Telemetry & Logging Overhead',
    content: `
      <h5>Logging Best Practices</h5>
      <p>Logging is essential for debugging, but careless logging kills performance.</p>

      <h5>Avoid String Concatenation in Logs</h5>
      <pre>// BAD - String concatenation happens even if log is disabled
logger.debug("Motor " + id + " velocity: " + velocity + " at " + Timer.getFPGATimestamp());

// GOOD - Use suppliers or check log level first
if (logger.isDebugEnabled()) {
    logger.debug("Motor {} velocity: {} at {}", id, velocity, Timer.getFPGATimestamp());
}</pre>

      <h5>Reduce SmartDashboard Updates</h5>
      <pre>// BAD - Updating every loop
public void periodic() {
    SmartDashboard.putNumber("Speed", getSpeed());
}

// GOOD - Throttle updates
private int dashboardCounter = 0;
public void periodic() {
    if (++dashboardCounter >= 5) { // Every 100ms instead of 20ms
        SmartDashboard.putNumber("Speed", getSpeed());
        dashboardCounter = 0;
    }
}</pre>
    `,
  },
  {
    title: '4. Swerve Drive Specific',
    content: `
      <h5>YAGSL CAN ID Limits</h5>
      <p>YAGSL (Yet Another Generic Swerve Library) recommends keeping total CAN IDs under 40 to prevent bus saturation.</p>
      <p>A swerve drive typically uses: 8 motors + 4 encoders = 12 CAN devices minimum. Add your arm, intake, shooter, and you can hit limits fast.</p>

      <h5>Odometry Thread Blocking</h5>
      <p>Many swerve libraries run odometry in a separate thread. If your main code modifies shared state without proper synchronization, you'll get race conditions or stalls.</p>
      <pre>// Use thread-safe patterns
private final Object odometryLock = new Object();

public void updateOdometry(Pose2d pose) {
    synchronized (odometryLock) {
        this.currentPose = pose;
    }
}</pre>

      <h5>Module Optimization State</h5>
      <p>Always optimize your swerve module states to prevent unnecessary wheel rotation:</p>
      <pre>SwerveModuleState optimized = SwerveModuleState.optimize(
    desiredState,
    currentRotation
);</pre>
    `,
  },
  {
    title: '5. Vision & Autonomous',
    content: `
      <h5>Limelight Latency Compensation</h5>
      <p>When using vision for pose estimation, you must account for camera latency:</p>
      <pre>// BAD - Ignoring latency
poseEstimator.addVisionMeasurement(visionPose, Timer.getFPGATimestamp());

// GOOD - Account for processing latency
double latencySeconds = limelightTable.getEntry("tl").getDouble(0) / 1000.0;
double captureTimestamp = Timer.getFPGATimestamp() - latencySeconds;
poseEstimator.addVisionMeasurement(visionPose, captureTimestamp);</pre>

      <h5>PathPlanner NamedCommands Pitfall</h5>
      <p>Commands must be registered BEFORE loading any paths that reference them:</p>
      <pre>// BAD - Loading path before registering command
PathPlannerPath path = PathPlannerPath.fromPathFile("MyPath");
NamedCommands.registerCommand("intake", intakeCommand);

// GOOD - Register all commands first
NamedCommands.registerCommand("intake", intakeCommand);
NamedCommands.registerCommand("shoot", shootCommand);
// Now safe to load paths
PathPlannerPath path = PathPlannerPath.fromPathFile("MyPath");</pre>

      <h5>Autonomous Mode Selection</h5>
      <p>Build your auto chooser in robotInit, not in autonomousInit:</p>
      <pre>// In robotInit()
autoChooser = new SendableChooser<>();
autoChooser.setDefaultOption("Simple Auto", simpleAuto);
autoChooser.addOption("Complex Auto", complexAuto);
SmartDashboard.putData("Auto Chooser", autoChooser);

// In autonomousInit()
currentAutoCommand = autoChooser.getSelected();
currentAutoCommand.schedule();</pre>
    `,
  },
];
