const { Stack, Duration } = require('aws-cdk-lib');

const { aws_ec2, aws_ecs, aws_elasticloadbalancingv2, aws_ecr } = require('aws-cdk-lib')

// const sqs = require('aws-cdk-lib/aws-sqs');

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

		// get our image
		const repo = aws_ecr.Repository.fromRepositoryArn(
			this,
			'Servic1Repo',
			`arn:aws:ecr:us-east-1:<account-number>:repository/express-app`
		)
		const image = aws_ecs.ContainerImage.fromEcrRepository(repo, 'latest')

		// task definition
		const taskDef = new aws_ecs.FargateTaskDefinition(
			this,
			'taskDef',
			{
				compatibility: aws_ecs.Compatibility.EC2_AND_FARGATE,
				cpu: '256',
				memoryMiB: '512',
				networkMode: aws_ecs.NetworkMode.AWS_VPC
			}
		)
		const container = taskDef.addContainer('Container', {
			image: image,
			memoryLimitMiB: 512
		})
		container.addPortMappings({
			containerPort: 1000,
			protocol: aws_ecs.Protocol.TCP
		})

		// create service
		const service = new aws_ecs.FargateService(
			this, 'service', {
			cluster: cluster,
			taskDefinition: taskDef,
			serviceName: 'service1'
		})

		// network the service with the load balancer
		const listener = alb.addListener('listener', {
			open: true,
			port: 80
		})

		// add target group to container
		listener.addTargets('service1', {
			targetGroupName: 'Service1Target',
			port: 80,
			targets: [service]
		})

	}
}

module.exports = { EcsFargateSingleServiceStack }
