const { Stack, Duration } = require('aws-cdk-lib');

const {
	aws_ec2,
	aws_ecs,
	aws_ecr,
	aws_route53,
	aws_route53_targets,
	aws_elasticloadbalancingv2
} = require('aws-cdk-lib')

class EcsFargateSingleServiceStack extends Stack {
	/**
	 *
	 * @param {Construct} scope
	 * @param {string} id
	 * @param {StackProps=} props
	 */
	constructor(scope, id, props) {
		super(scope, id, props);

		// base infrastucture
		const vpc = new aws_ec2.Vpc(this, 'VPC', { maxAzs: 2 })

		const cluster = new aws_ecs.Cluster(this, 'Cluster', {
			clusterName: 'Services',
			vpc: vpc
		})

		const alb = new aws_elasticloadbalancingv2.ApplicationLoadBalancer(this, 'ALB', {
			vpc: vpc,
			internetFacing: true,
			loadBalancerName: 'ServicesLB'
		})

		// I'm using a domain I own: thabolebelo.com
		const zone = aws_route53.HostedZone.fromLookup(this, 'HostedZone', {
			domainName: 'thabolebelo.com'
		})

		// create DNS record to point to the load balancer
		new aws_route53.ARecord(this, 'servicesSubdomain', {
			zone: zone,
			recordName: 'services',
			target: aws_route53.RecordTarget.fromAlias(
				new aws_route53_targets.LoadBalancerTarget(alb)
			),
			ttl: Duration.seconds(300),
			comment: 'services subdomain'
		})

		// get our images
		const repo = aws_ecr.Repository.fromRepositoryArn(this, 'Servic1Repo', `arn:aws:ecr:us-east-1:737327749629:repository/container-app`)
		const navRepo = aws_ecr.Repository.fromRepositoryArn(this, 'NavigationRepo', 'arn:aws:ecr:us-east-1:737327749629:repository/navigation-app')
		const homeRepo = aws_ecr.Repository.fromRepositoryArn(this, 'HomeRepo', 'arn:aws:ecr:us-east-1:737327749629:repository/home-app')
		const detailsRepo = aws_ecr.Repository.fromRepositoryArn(this, 'DetailsRepo', 'arn:aws:ecr:us-east-1:737327749629:repository/details-app')

		const image = aws_ecs.ContainerImage.fromEcrRepository(repo, 'latest')
		const navImage = aws_ecs.ContainerImage.fromEcrRepository(navRepo, 'latest');
		const homeImage = aws_ecs.ContainerImage.fromEcrRepository(homeRepo, 'latest');
		const detailsImage = aws_ecs.ContainerImage.fromEcrRepository(detailsRepo, 'latest');

		// task definitions
		const taskDef = new aws_ecs.FargateTaskDefinition(this, 'taskDef', {
			compatibility: aws_ecs.Compatibility.EC2_AND_FARGATE,
			cpu: '256',
			memoryMiB: '512',
			networkMode: aws_ecs.NetworkMode.AWS_VPC
		})

		const navTaskDefinitions = new aws_ecs.FargateTaskDefinition(this, 'navTaskDef', {
			compatibility: aws_ecs.Compatibility.EC2_AND_FARGATE,
			cpu: '256',
			memoryMiB: '512',
			networkMode: aws_ecs.NetworkMode.AWS_VPC
		})

		const homeTaskDefinition = new aws_ecs.FargateTaskDefinition(this, 'homeTaskDef', {
			compatibility: aws_ecs.Compatibility.EC2_AND_FARGATE,
			cpu: '256',
			memoryMiB: '512',
			networkMode: aws_ecs.NetworkMode.AWS_VPC
		})

		const detailsTaskDefinition = new aws_ecs.FargateTaskDefinition(this, 'detailsTaskDef', {
			compatibility: aws_ecs.Compatibility.EC2_AND_FARGATE,
			cpu: '256',
			memoryMiB: '512',
			networkMode: aws_ecs.NetworkMode.AWS_VPC
		})

		const container = taskDef.addContainer('Container', {
			image: image,
			memoryLimitMiB: 512
		})
		container.addPortMappings({
			containerPort: 9000,
			protocol: aws_ecs.Protocol.TCP
		})

		const navContainer = navTaskDefinitions.addContainer('Navigation', {
			image: navImage,
			memoryLimitMiB: 512
		})
		navContainer.addPortMappings({
			containerPort: 9002,
			protocol: aws_ecs.Protocol.TCP
		})

		const homeContainer = homeTaskDefinition.addContainer('Home', {
			image: homeImage,
			memoryLimitMiB: 512
		})
		homeContainer.addPortMappings({
			containerPort: 9001,
			protocol: aws_ecs.Protocol.TCP
		})

		const detailsContainer = detailsTaskDefinition.addContainer('Details', {
			image: detailsImage,
			memoryLimitMiB: 512
		})

		detailsContainer.addPortMappings({
			containerPort: 9003,
			protocol: aws_ecs.Protocol.TCP
		})

		// create service
		const service = new aws_ecs.FargateService(this, 'conService', {
			cluster: cluster,
			taskDefinition: taskDef,
			serviceName: 'conService'
		})

		const navService = new aws_ecs.FargateService(this, 'navService', {
			cluster: cluster,
			taskDefinition: navTaskDefinitions,
			serviceName: 'navService'
		})

		const homeService = new aws_ecs.FargateService(this, 'homeService', {
			cluster: cluster,
			taskDefinition: homeTaskDefinition,
			serviceName: 'homeService'
		})

		const detailsService = new aws_ecs.FargateService(this, 'detailsService', {
			cluster: cluster,
			taskDefinition: detailsTaskDefinition,
			serviceName: 'detailsService'
		})

		// network the service with the load balancer
		const listener = alb.addListener('listener', {
			open: true,
			port: 80
		})

		// add target group to container
		listener.addTargets('conService', {
			targetGroupName: 'ContainerService',
			port: 80,
			targets: [service]
		})

		listener.addTargets('navService', {
			targetGroupName: 'NavigationService',
			port: 80,
			targets: [navService],
			priority: 1,
			conditions: [aws_elasticloadbalancingv2.ListenerCondition.pathPatterns(['/thabo-navigation.js'])]
		})

		listener.addTargets('homeService', {
			targetGroupName: 'HomeService',
			port: 80,
			targets: [homeService],
			priority: 2,
			conditions: [aws_elasticloadbalancingv2.ListenerCondition.pathPatterns(['/thabo-home.js'])]
		})

		listener.addTargets('detailsService', {
			targetGroupName: 'DetailsService',
			port: 80,
			targets: [detailsService],
			priority: 3,
			conditions: [aws_elasticloadbalancingv2.ListenerCondition.pathPatterns(['/thabo-details.js'])]
		})

	}
}

module.exports = { EcsFargateSingleServiceStack }
